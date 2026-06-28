/* ============================================================
   dashboard.js — protected dashboard page
   Reads /latest, /readings, /alerts in realtime; renders hero,
   ladder, 7-day chart, alert bar, alert history. Graceful empty
   states when Firebase has no data yet.
   ============================================================ */
"use strict";

let DASH = { latest:null, readings:[], alerts:[] };
let alertDismissed = false;
let chart = null;
let lastEgg = 0;
let ladderBuilt = false;
let openLevel = -1;

/* ---------------- Boot (after auth guard) ---------------- */
function initDashboard(user){
  buildLadder();
  bindStaticUI();
  attachListeners();
  // Re-check camera online/offline every minute (the threshold is time-based,
  // so status can change even with no new Firebase data).
  renderCamStatus();
  setInterval(renderCamStatus, 60000);
}

function bindStaticUI(){
  document.getElementById("alertClose").addEventListener("click", ()=>{
    alertDismissed = true;
    document.getElementById("alertBar").hidden = true;
  });
  document.getElementById("bell").addEventListener("click", ()=>{
    document.getElementById("alertList").scrollIntoView({ behavior:"smooth", block:"center" });
  });
}

/* ---------------- Realtime listeners ---------------- */
function attachListeners(){
  if (!fbDB){ markEmpty(); return; }
  setConnState();

  try {
    fbDB.ref("latest").on("value", snap => {
      try {
        DASH.latest = snap.val();
        renderDashboard();
      } catch(e){ console.warn("latest", e); }
    }, err => { console.warn("latest err", err); });

    fbDB.ref("readings").on("value", snap => {
      try {
        const v = snap.val();
        DASH.readings = v ? Object.values(v).filter(r=>r && r.ts!=null).sort((a,b)=>a.ts-b.ts) : [];
        renderDashboard();
      } catch(e){ console.warn("readings", e); }
    }, err => { console.warn("readings err", err); });

    fbDB.ref("alerts").on("value", snap => {
      try {
        const v = snap.val();
        DASH.alerts = v ? Object.values(v).filter(a=>a && a.ts!=null) : [];
        renderDashboard();
      } catch(e){ console.warn("alerts", e); }
    }, err => { console.warn("alerts err", err); });

  } catch(e){
    console.error("attachListeners failed", e);
    markEmpty();
  }
}

/* ---------------- Connection status dot ---------------- */
function setConnState(){
  try {
    fbDB.ref(".info/connected").on("value", snap => {
      const ok = snap.val() === true;
      const dot = document.getElementById("statusDot");
      const txt = document.getElementById("statusText");
      if (!dot) return;
      dot.classList.toggle("live", ok);
      txt.textContent = ok ? "เชื่อมต่อแล้ว / Live" : "กำลังเชื่อมต่อ / Connecting";
    });
  } catch(e){ /* ignore */ }
}

/* ---------------- Master render ---------------- */
function renderDashboard(){
  // remove skeletons on first data tick
  document.querySelectorAll(".skeleton").forEach(s => s.classList.remove("skeleton"));
  renderHeaderMeta();
  renderCamStatus();
  renderAlertBar();
  renderHero();
  renderLadder();
  renderChart();
  renderAlerts();
  refreshIcons();   // re-draw any Lucide icons injected this tick
}

function markEmpty(){
  document.querySelectorAll(".skeleton").forEach(s => s.classList.remove("skeleton"));
  renderCamStatus();
  renderHero();      // shows empty-state text
  renderChart();
  renderAlerts();
  refreshIcons();
}

/* ---------------- Camera online/offline badge ---------------- */
function renderCamStatus(){
  const wrap = document.getElementById("camStatus");
  if (!wrap) return;
  const ts = DASH.latest ? DASH.latest.ts : null;
  const s = camStatus(ts);                 // from data.js (shared with live page)
  wrap.classList.toggle("live", s.online); // green dot when online
  wrap.classList.toggle("off", !s.online); // red/grey dot when offline
  const txt = document.getElementById("camText");
  if (txt){
    txt.textContent = ts ? ("กล้อง" + s.th + " · " + s.rel)
                         : "กล้อง: ยังไม่มีข้อมูลจากกับดัก";
  }
}

/* ---------------- Header meta (updated time + bell badge) ---------------- */
function renderHeaderMeta(){
  const ts = DASH.latest ? DASH.latest.ts : null;
  const rel = document.getElementById("updatedRel");
  const abs = document.getElementById("updatedAbs");
  if (rel) rel.textContent = "อัปเดต" + thRelative(ts);
  if (abs) abs.textContent = thAbsolute(ts);

  const badge = document.getElementById("bellBadge");
  const n = DASH.alerts.length;
  if (badge){
    if (n > 0){ badge.hidden = false; badge.textContent = n > 99 ? "99+" : n; }
    else badge.hidden = true;
  }
}

/* ---------------- Urgent alert bar ---------------- */
function renderAlertBar(){
  const bar = document.getElementById("alertBar");
  const latest = DASH.latest;
  if (!latest || alertDismissed){ bar.hidden = true; return; }

  const lv  = resolveLevel(latest);
  const roc = Number(latest.rateOfChange) || 0;
  if (!(lv >= 2 || roc >= ROC_ALERT)){ bar.hidden = true; return; }

  const L = LEVELS[lv];
  bar.hidden = false;
  bar.classList.remove("lv2","lv3");
  bar.classList.add(lv >= 3 ? "lv3" : "lv2", "slide-in");

  const pct = Math.round(roc * 100);
  let titleTh, titleEn;
  if (roc >= ROC_ALERT && lv < 2){
    titleTh = "สัญญาณเตือนล่วงหน้า: ไข่เพิ่มเร็วผิดปกติ";
    titleEn = "Early warning: eggs rising abnormally fast";
  } else {
    titleTh = "เตือนภัย: ระดับความเสี่ยง" + L.th;
    titleEn = "Alert: risk level " + L.en;
  }
  document.getElementById("alertTitle").textContent = titleTh;
  document.getElementById("alertTitleEn").textContent = titleEn;

  const trend = roc > 0 ? ("ไข่เพิ่มขึ้น " + pct + "% จากครั้งก่อน")
              : roc < 0 ? ("ไข่ลดลง " + Math.abs(pct) + "% จากครั้งก่อน")
              : "จำนวนไข่คงที่";
  document.getElementById("alertDetail").textContent =
    `${trend} · ประมาณ ${eggRangeText(lv)} — ${L.recoTh} (${L.recoEn})`;
}

/* ---------------- Hero risk card ---------------- */
function renderHero(){
  const latest = DASH.latest;
  const hero = document.getElementById("hero");
  const lvlEl = document.getElementById("heroLevel");

  if (!latest){
    // standby ring: neutral grey, calm
    hero.style.setProperty("--lvl", "var(--text-muted)");
    hero.style.setProperty("--lvl-glow", "rgba(118,132,159,.25)");
    hero.style.setProperty("--pulse-dur", "4s");
    lvlEl.style.color = "var(--text-secondary)";
    lvlEl.innerHTML = 'ยังไม่มีข้อมูล<span class="en">No data yet — waiting for device</span>';
    document.getElementById("heroReco").childNodes[0].nodeValue = "รออุปกรณ์ส่งค่าแรกเข้าระบบ";
    document.getElementById("heroRecoEn").textContent = "Waiting for the first reading";
    document.getElementById("eggNum").textContent = "—";
    const roc = document.getElementById("roc");
    roc.className = "roc flat";
    roc.innerHTML = '— <span class="en">เทียบครั้งก่อน / vs previous</span>';
    return;
  }

  const lv = resolveLevel(latest);
  const L = LEVELS[lv];
  const roc = Number(latest.rateOfChange) || 0;

  // SIGNATURE: drive the radar pulse ring color + speed from the current
  // level and rate-of-change. Faster pulse = signal rising faster.
  const dur = Math.max(1.25, 3.8 - Math.abs(roc) * 3.4 - lv * 0.25).toFixed(2);
  hero.style.setProperty("--lvl", L.color);
  hero.style.setProperty("--lvl-glow", L.glow);
  hero.style.setProperty("--pulse-dur", dur + "s");

  lvlEl.style.color = L.color;
  lvlEl.innerHTML = L.th + '<span class="en">' + L.en + '</span>';
  document.getElementById("heroReco").childNodes[0].nodeValue = L.recoTh;
  document.getElementById("heroRecoEn").textContent = L.recoEn;

  // DISPLAY-ONLY: show the egg-count RANGE figure (e.g. "100+"), not the raw
  // class midpoint. "ฟอง" unit + the level name sit beside it in the card.
  document.getElementById("eggNum").textContent = eggRangeFigure(lv);
  lastEgg = Number(latest.eggCount) || 0;

  const r = rocText(latest.rateOfChange);
  const rocEl = document.getElementById("roc");
  rocEl.className = "roc " + r.cls;
  rocEl.innerHTML = r.arrow + ' <span class="en">เทียบครั้งก่อน / vs previous</span>';
}

/* ---------------- 4-level ladder ---------------- */
function buildLadder(){
  const wrap = document.getElementById("ladder");
  wrap.innerHTML = "";
  LEVELS.forEach((L,i)=>{
    const btn = document.createElement("button");
    btn.className = "lv-btn";
    btn.style.color = L.color;
    btn.style.setProperty("--glow", L.glow);
    btn.style.setProperty("--on", L.on);
    btn.setAttribute("data-level", i);
    btn.innerHTML =
      '<span class="swatch"><i data-lucide="'+L.icon+'"></i></span>' +
      '<span class="lv-th">'+L.th+'</span>' +
      '<span class="lv-en">'+L.en+'</span>' +
      '<span class="lv-range">'+eggRangeText(i)+'</span>';
    btn.addEventListener("click", ()=> toggleLadder(i));
    wrap.appendChild(btn);
  });
  const det = document.createElement("div");
  det.className = "lv-detail";
  det.id = "lvDetail";
  wrap.appendChild(det);
  ladderBuilt = true;
  refreshIcons();   // render the ladder's Lucide icons
}
function toggleLadder(i){
  const det = document.getElementById("lvDetail");
  if (openLevel === i){ det.classList.remove("open"); openLevel = -1; return; }
  openLevel = i;
  const L = LEVELS[i];
  det.style.color = L.color;
  det.innerHTML =
    '<div class="lv-detail-th">'+L.th+' ('+L.en+') · '+eggRangeText(i)+'</div>' +
    '<div style="color:var(--ink)">'+L.recoTh+'<span class="en">'+L.recoEn+'</span></div>';
  det.classList.add("open");
}
function renderLadder(){
  const lv = DASH.latest ? resolveLevel(DASH.latest) : -1;
  document.querySelectorAll(".lv-btn").forEach(btn=>{
    const i = +btn.getAttribute("data-level");
    btn.setAttribute("aria-current", i === lv ? "true" : "false");
  });
}

/* ---------------- 7-day trend chart ---------------- */
function renderChart(){
  const ctx = document.getElementById("trendChart");
  const empty = document.getElementById("chartEmpty");
  const readings = DASH.readings.slice(-7);

  if (readings.length === 0){
    if (chart){ chart.destroy(); chart = null; }
    ctx.style.display = "none";
    empty.hidden = false;
    return;
  }
  ctx.style.display = "block";
  empty.hidden = true;

  const labels = readings.map(r => thShortDate(r.ts));
  const data   = readings.map(r => Number(r.eggCount) || 0);
  // latest point glows teal; earlier points carry their level color
  const last   = readings.length - 1;
  const colors = readings.map((r,i)=> i === last ? "#34E0C4" : LEVELS[resolveLevel(r)].color);
  const radii  = readings.map((_,i)=> i === last ? 7 : 4);
  const hover  = readings.map((_,i)=> i === last ? 9 : 6);
  const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  // dark instrument palette
  const CYAN = "#45C9F5", GRID = "rgba(255,255,255,0.06)";
  const TXT = "#AEBCD6";
  const mono = "IBM Plex Mono";

  // cyan→transparent vertical area fill
  const g2d = ctx.getContext("2d");
  const grad = g2d.createLinearGradient(0, 0, 0, ctx.clientHeight || 300);
  grad.addColorStop(0, "rgba(69,201,245,.32)");
  grad.addColorStop(1, "rgba(69,201,245,0)");

  const cfg = {
    type:"line",
    data:{
      labels,
      datasets:[
        {
          label:"ระดับไข่ (ประมาณ) / Egg level (approx.)", data,
          borderColor:CYAN, backgroundColor:grad,
          fill:true, tension:.35, borderWidth:2.5,
          pointBackgroundColor:colors, pointBorderColor:"#0D1525", pointBorderWidth:2,
          pointRadius:radii, pointHoverRadius:hover
        },
        {
          label:"เกณฑ์เสี่ยง / Risk threshold",
          data:labels.map(()=>RISK_THRESHOLD_EGGS),
          borderColor:"#FB9A3E", borderWidth:2, borderDash:[6,6],
          pointRadius:0, fill:false, tension:0
        }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{ duration: reduce ? 0 : 600 },
      interaction:{ mode:"index", intersect:false },
      plugins:{
        legend:{ labels:{ usePointStyle:true, color:TXT, font:{ family:"IBM Plex Sans Thai" } } },
        tooltip:{
          backgroundColor:"rgba(24,35,61,.96)", borderColor:"rgba(255,255,255,.08)", borderWidth:1,
          titleColor:"#ECF2FF", bodyColor:TXT, padding:11, cornerRadius:10, displayColors:true,
          titleFont:{ family:"IBM Plex Sans Thai", weight:"600" }, bodyFont:{ family:mono },
          callbacks:{
            label:(c)=>{
              if (c.datasetIndex === 1) return "เกณฑ์เสี่ยง 31 ฟอง / Risk threshold";
              // DISPLAY-ONLY: show level name + RANGE, not the raw midpoint
              const lv = resolveLevel(readings[c.dataIndex]);
              return eggRangeLabel(lv).th;   // e.g. "อันตราย (100+ ฟอง)"
            }
          }
        }
      },
      scales:{
        y:{ beginAtZero:true, grid:{ color:GRID }, border:{ color:GRID },
            title:{ display:true, text:"ระดับไข่ (ประมาณ) / Egg level (approx.)", color:TXT, font:{family:"IBM Plex Sans Thai"} },
            ticks:{ color:TXT, font:{family:mono} } },
        x:{ grid:{ color:GRID }, border:{ color:GRID },
            ticks:{ color:TXT, font:{family:mono} } }
      }
    }
  };

  if (chart){
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = grad;
    chart.data.datasets[0].pointBackgroundColor = colors;
    chart.data.datasets[0].pointRadius = radii;
    chart.data.datasets[0].pointHoverRadius = hover;
    chart.data.datasets[1].data = labels.map(()=>RISK_THRESHOLD_EGGS);
    chart.update();
  } else {
    chart = new Chart(ctx, cfg);
  }
}

/* ---------------- Telegram alert history ---------------- */
function renderAlerts(){
  const list = document.getElementById("alertList");
  const alerts = DASH.alerts.slice().sort((a,b)=> b.ts - a.ts);
  if (alerts.length === 0){
    list.innerHTML = '<div class="empty">ยังไม่มีการแจ้งเตือน<span class="en">No alerts yet</span></div>';
    return;
  }
  list.innerHTML = "";
  alerts.forEach(a=>{
    const lv = Number.isInteger(a.level) ? a.level : 0;
    const L = LEVELS[lv];
    const row = document.createElement("div");
    row.className = "alert-row";
    row.innerHTML =
      '<span class="chip" style="background:'+L.color+';color:'+L.on+';--glow:'+L.glow+'">'+L.th+'</span>' +
      '<div class="msg">'+escapeHtml(a.message)+
        '<div class="time">'+thAbsolute(a.ts)+' · '+thRelative(a.ts)+'</div>' +
      '</div>';
    list.appendChild(row);
  });
}
