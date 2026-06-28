/* ============================================================
   live.js — Live Camera page
   Shows a live MJPEG-style feed by polling http://<ip>/capture every
   3s, lets the user set/remember the camera IP (localStorage), and
   shows the latest AI result from Firebase /latest so the page stays
   useful even when the local image can't load (e.g. different WiFi).
   ============================================================ */
"use strict";

const CAM_IP_DEFAULT = "10.56.64.182";   // ค่าเริ่มต้น (แก้ได้ในหน้าเว็บ)
const CAM_IP_KEY     = "camIp";          // คีย์ใน localStorage สำหรับจำ IP
const LIVE_REFRESH_MS = 3000;            // รีเฟรชภาพทุก 3 วินาที

let camIp = CAM_IP_DEFAULT;
let liveTimer = null;
let LIVE_LATEST = null;

/* ---------------- Boot (after auth guard) ---------------- */
function initLivePage(user){
  // 1) โหลด IP ที่จำไว้จาก localStorage (ถ้ามี)
  try {
    const saved = localStorage.getItem(CAM_IP_KEY);
    if (saved) camIp = saved;
  } catch(e){ /* localStorage อาจถูกปิด — ใช้ค่า default */ }

  const ipInput = document.getElementById("camIpInput");
  if (ipInput) ipInput.value = camIp;

  // 2) ฟอร์ม "เชื่อมต่อ"
  const form = document.getElementById("camForm");
  if (form) form.addEventListener("submit", e => { e.preventDefault(); connectCam(); });

  // 3) ผูก event โหลดรูปสำเร็จ/ล้มเหลว แล้วเริ่มสตรีม
  const img = document.getElementById("liveImg");
  if (img){
    img.addEventListener("load", onLiveLoad);
    img.addEventListener("error", onLiveError);
  }
  startLiveStream();

  // 4) ฟัง /latest เพื่อแสดงผล AI ล่าสุด + สถานะกล้อง (online/offline)
  attachLatestListener();
  renderCamStatusLive();
  setInterval(renderCamStatusLive, 60000);   // เกณฑ์ offline อิงเวลา จึงเช็กซ้ำทุกนาที
}

/* ---------------- Camera IP + live image ---------------- */
function connectCam(){
  const ipInput = document.getElementById("camIpInput");
  if (!ipInput) return;
  const v = ipInput.value.trim();
  if (!v){ showToast("กรุณากรอก IP ของกล้อง", "error"); return; }
  camIp = v;
  try { localStorage.setItem(CAM_IP_KEY, camIp); } catch(e){ /* ignore */ }
  showToast("กำลังเชื่อมต่อกล้องที่ " + camIp, "info");
  // กลับไปแสดง placeholder ระหว่างลองโหลดใหม่
  setShown("livePlaceholder", true); setShown("liveError", false); setShown("liveImg", false);
  refreshLive();
}

function liveImgUrl(){
  // ?t=timestamp เพื่อ bypass cache (กล้องส่งภาพนิ่งจาก /capture)
  return "http://" + camIp + "/capture?t=" + Date.now();
}

function startLiveStream(){
  refreshLive();
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(refreshLive, LIVE_REFRESH_MS);
}

function refreshLive(){
  const img = document.getElementById("liveImg");
  if (img) img.src = liveImgUrl();   // ตั้ง src ใหม่ทุกครั้ง (แม้ตอนซ่อนอยู่)
}

function setShown(id, show){
  const el = document.getElementById(id);
  if (el) el.hidden = !show;
}

function onLiveLoad(){
  setShown("liveImg", true);
  setShown("liveError", false);
  setShown("livePlaceholder", false);
  const t = document.getElementById("liveStamp");
  if (t) t.textContent = "เฟรมล่าสุด: " + new Date().toLocaleTimeString("th-TH");
}
function onLiveError(){
  // โหลดรูปไม่ได้ (กล้องดับ / คนละ WiFi) — แสดงข้อความ + placeholder
  setShown("liveImg", false);
  setShown("livePlaceholder", false);
  setShown("liveError", true);
  const t = document.getElementById("liveStamp");
  if (t) t.textContent = "—";
}

/* ---------------- Firebase /latest (AI result + cam status) ---------------- */
function attachLatestListener(){
  if (!fbDB){ renderAiResult(null); return; }
  try {
    fbDB.ref("latest").on("value", snap => {
      LIVE_LATEST = snap.val();
      renderAiResult(LIVE_LATEST);
      renderCamStatusLive();
    }, err => { console.warn("latest err", err); renderAiResult(null); });
  } catch(e){
    console.warn("attachLatestListener failed", e);
    renderAiResult(null);
  }
}

function renderAiResult(latest){
  const box = document.getElementById("aiResult");
  if (!box) return;
  if (!latest){
    box.innerHTML = '<div class="empty">ยังไม่มีข้อมูลจากกับดัก<span class="en">No data yet</span></div>';
    return;
  }
  const lv = resolveLevel(latest);
  const L  = LEVELS[lv];
  const label = eggRangeLabel(lv);              // {th:"อันตราย (100+ ฟอง)", en:"Danger (100+)"}
  const r = rocText(latest.rateOfChange);
  box.innerHTML =
    '<div class="ai-row">' +
      '<span class="chip" style="background:'+L.color+';color:'+L.on+';--glow:'+L.glow+'">'+L.th+' / '+L.en+'</span>' +
    '</div>' +
    '<div class="ai-big" style="color:'+L.color+'">'+escapeHtml(label.th)+'</div>' +
    '<div class="ai-sub">'+escapeHtml(label.en)+'</div>' +
    '<div class="ai-meta">อัตราเปลี่ยนแปลง: <b class="'+r.cls+'">'+r.arrow+'</b> เทียบครั้งก่อน</div>' +
    '<div class="ai-meta">'+thAbsolute(latest.ts)+' · '+thRelative(latest.ts)+'</div>';
  refreshIcons();
}

/* ---------------- Camera online/offline badge (shared logic) ---------------- */
function renderCamStatusLive(){
  const wrap = document.getElementById("camStatus");
  if (!wrap) return;
  const ts = LIVE_LATEST ? LIVE_LATEST.ts : null;
  const s = camStatus(ts);                 // from data.js (same as dashboard)
  wrap.classList.toggle("live", s.online);
  wrap.classList.toggle("off", !s.online);
  const txt = document.getElementById("camText");
  if (txt){
    txt.textContent = ts ? ("กล้อง" + s.th + " · " + s.rel)
                         : "กล้อง: ยังไม่มีข้อมูลจากกับดัก";
  }
}
