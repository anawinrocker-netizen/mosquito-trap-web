/* ============================================================
   data.js — shared constants & helpers (used by every page)
   - Risk level definitions, colors, recommendations
   - levelFromEggs() fallback
   - Thai date / relative-time formatters
   - small DOM + toast helpers
   ============================================================ */
"use strict";

/* ---------- Risk levels (single source of truth) ----------
   "Midnight Surveillance" palette: colors glow on navy and keep AA.
   `on` = dark text-on for chips/pills (light text fails AA on these
   luminous hues). `glow` = box-shadow tint. `icon` = Lucide name. */
/* NOTE: egg-count ranges live in EGG_RANGES below (single source of truth);
   use eggRangeText(level) for the per-level range string. */
const LEVELS = [
  { th:"ปลอดภัย",  en:"Safe",    color:"#2BD96B", glow:"rgba(43,217,107,.40)",  on:"#062012", icon:"shield-check",
    recoTh:"ยังไม่พบไข่ ตรวจตามปกติ",                  recoEn:"No eggs — routine check" },
  { th:"เฝ้าระวัง", en:"Watch",   color:"#F4CE45", glow:"rgba(244,206,69,.40)",  on:"#2A2102", icon:"eye",
    recoTh:"เริ่มมีไข่ คอยสังเกต",                     recoEn:"Eggs appearing — keep watching" },
  { th:"เสี่ยง",    en:"At Risk", color:"#FB9A3E", glow:"rgba(251,154,62,.42)",  on:"#2A1602", icon:"triangle-alert",
    recoTh:"ไข่เกินเกณฑ์ ควรกำจัดแหล่งน้ำขัง",         recoEn:"Above threshold — remove standing water" },
  { th:"อันตราย",  en:"Danger",  color:"#FB6B6B", glow:"rgba(251,107,107,.45)", on:"#2A0707", icon:"siren",
    recoTh:"ไข่หนาแน่นมาก แจ้งเจ้าหน้าที่/อสม. ทันที", recoEn:"Very high — notify officials now" }
];

/* ---------- Egg-count RANGES (DISPLAY ONLY) ----------
   The classifier is 4-class, so the stored eggCount (0/15/65/150) is just a
   class MIDPOINT — not a real count. We keep eggCount in Firebase for charting
   but show these RANGES anywhere a number would otherwise look exact.
   `figure` = short text for the hero card; `th`/`en` = range strings. */
const EGG_RANGES = [
  { figure:"0",      th:"0 ฟอง",      en:"0 eggs" },
  { figure:"1–30",   th:"1–30 ฟอง",   en:"1–30"   },
  { figure:"31–100", th:"31–100 ฟอง", en:"31–100" },
  { figure:"100+",   th:"100+ ฟอง",   en:"100+"   }
];
/* Clamp any value to a valid 0–3 level index. */
function _lvIdx(level){
  const i = Number(level);
  return (Number.isInteger(i) && i >= 0 && i <= 3) ? i : 0;
}
/* Short hero figure, e.g. "100+" (paired with the unit "ฟอง" in the card). */
function eggRangeFigure(level){
  return EGG_RANGES[_lvIdx(level)].figure;
}
/* Full Thai/English range label, e.g. {th:"อันตราย (100+ ฟอง)", en:"Danger (100+)"}. */
function eggRangeLabel(level){
  const i = _lvIdx(level);
  return { th: LEVELS[i].th + " (" + EGG_RANGES[i].th + ")",
           en: LEVELS[i].en + " (" + EGG_RANGES[i].en + ")" };
}
/* Just the range part, e.g. "100+ ฟอง" (no level name). */
function eggRangeText(level){
  return EGG_RANGES[_lvIdx(level)].th;
}

/* Re-render Lucide icons after dynamic DOM injection (no-op if CDN absent). */
function refreshIcons(){
  try { if (window.lucide && typeof lucide.createIcons === "function") lucide.createIcons(); }
  catch(e){ /* ignore */ }
}

const RISK_THRESHOLD_EGGS = 31;   // level >= 2
const ROC_ALERT = 0.5;            // >= 50% jump triggers early warning

/* AI normally supplies `level`; this is the fallback mapping. */
function levelFromEggs(n){
  n = Number(n) || 0;
  if (n <= 0)   return 0;
  if (n <= 30)  return 1;
  if (n <= 100) return 2;
  return 3;
}
/* Use a valid provided level, else derive from eggs. */
function resolveLevel(o){
  if (o && Number.isInteger(o.level) && o.level >= 0 && o.level <= 3) return o.level;
  return levelFromEggs(o ? o.eggCount : 0);
}

/* ---------- Thai time formatters ---------- */
function thRelative(ts){
  if (!ts) return "—";
  const diff = Date.now() - Number(ts);
  const m = Math.round(diff / 60000);
  if (m < 1)  return "เมื่อสักครู่";
  if (m < 60) return "เมื่อ " + m + " นาทีที่แล้ว";
  const h = Math.round(m / 60);
  if (h < 24) return "เมื่อ " + h + " ชั่วโมงที่แล้ว";
  const d = Math.round(h / 24);
  return "เมื่อ " + d + " วันที่แล้ว";
}
function thAbsolute(ts){
  if (!ts) return "—";
  return new Date(Number(ts)).toLocaleString("th-TH", {
    day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"
  });
}
function thShortDate(ts){
  return new Date(Number(ts)).toLocaleDateString("th-TH", { day:"numeric", month:"short" });
}

/* ---------- Camera online/offline status (shared by dashboard + live page) ----------
   The trap captures every 6 hours, so we treat "no reading for >7h" as offline
   to avoid false alarms. Threshold + helper live here so all pages agree. */
const CAM_OFFLINE_MS = 25200000;   // 7 ชั่วโมง (25,200,000 มิลลิวินาที)

function isCameraOnline(ts){
  if (!ts) return false;
  return (Date.now() - Number(ts)) < CAM_OFFLINE_MS;
}
/* Returns a ready-to-display status object for a /latest timestamp. */
function camStatus(ts){
  const online = isCameraOnline(ts);
  return {
    online,
    th:  online ? "ออนไลน์" : "ออฟไลน์",
    en:  online ? "Online"  : "Offline",
    // relative time, e.g. "อัปเดตล่าสุดเมื่อ 2 ชั่วโมงที่แล้ว"
    rel: ts ? ("อัปเดตล่าสุด" + thRelative(ts)) : "ยังไม่มีข้อมูลจากกับดัก"
  };
}

/* ---------- Misc helpers ---------- */
function escapeHtml(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function rocText(roc){
  const pct = Math.round((Number(roc) || 0) * 100);
  if (roc > 0.001)  return { arrow:"▲ +" + pct + "%", cls:"up" };
  if (roc < -0.001) return { arrow:"▼ " + pct + "%",  cls:"down" };
  return { arrow:"— 0%", cls:"flat" };
}

/* Count-up animation for a number element (respects reduced motion). */
function countUp(el, to, from){
  to = Number(to) || 0;
  from = Number(from) || 0;
  const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduce || from === to){ el.textContent = to; return; }
  const dur = 700, t0 = performance.now();
  function step(t){
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Toast notifications (creates a container on first use). */
function showToast(msg, type){
  let host = document.getElementById("toastHost");
  if (!host){
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = "toast " + (type || "info");
  t.textContent = msg;
  host.appendChild(t);
  // force reflow then show
  requestAnimationFrame(()=> t.classList.add("show"));
  setTimeout(()=>{
    t.classList.remove("show");
    setTimeout(()=> t.remove(), 300);
  }, 3200);
}
