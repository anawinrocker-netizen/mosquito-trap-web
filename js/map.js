/* ============================================================
   map.js — protected risk map page
   Leaflet map of Thailand; reads /traps in realtime; renders a
   heat layer, risk-zone circles, markers + popups, legend,
   and a level-count summary strip.
   ============================================================ */
"use strict";

const HEAT_INTENSITY = { 0:0.2, 1:0.45, 2:0.7, 3:1.0 };
const ZONE_RADIUS    = { 0:60,  1:120,  2:250, 3:450 }; // meters (Aedes flight range)

let map = null, heatLayer = null, trapGroup = null, legendCtrl = null;
let MAP_TRAPS = [];

/* ---------------- Boot (after auth guard) ---------------- */
function initMapPage(user){
  buildMap();
  attachTrapListener();
  // Leaflet needs a size recalculation once the container is laid out.
  setTimeout(()=> map && map.invalidateSize(), 80);
  window.addEventListener("resize", ()=> map && map.invalidateSize());
}

/* ---------------- Build base map ---------------- */
function buildMap(){
  map = L.map("map", { center:[13.0, 101.0], zoom:6, scrollWheelZoom:true });
  // CARTO dark base — matches the midnight surveillance theme
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:"&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains:"abcd", maxZoom:20
  }).addTo(map);

  heatLayer = L.heatLayer([], {
    radius:30, blur:22, maxZoom:9,
    gradient:{ 0.2:"#2BD96B", 0.45:"#F4CE45", 0.7:"#FB9A3E", 1.0:"#FB6B6B" }
  }).addTo(map);

  trapGroup = L.layerGroup().addTo(map);

  // Lucide icons inside popups render lazily — draw them when a popup opens.
  map.on("popupopen", refreshIcons);

  legendCtrl = L.control({ position:"bottomleft" });
  legendCtrl.onAdd = function(){
    const div = L.DomUtil.create("div", "legend");
    let rows = "";
    LEVELS.forEach((L,i) => {
      rows += '<div class="row"><span class="sw" style="background:'+L.color+'"></span>' +
              '<span>'+L.th+' <span class="lg-en">'+L.en+' · '+eggRangeText(i)+'</span></span></div>';
    });
    div.innerHTML =
      '<h4>ระดับความเสี่ยง<span class="en">Risk Levels</span></h4>' + rows +
      '<div class="note">ขนาดวงสะท้อนรัศมีเสี่ยงโดยประมาณตามระยะบินยุงลาย ' +
      '(เฉลี่ย ~106 ม. ควบคุมพาหะ ~200 ม. สูงสุด ~850 ม.)<br>' +
      '<span class="lg-en">Zone size ≈ estimated Aedes flight range</span></div>';
    return div;
  };
  legendCtrl.addTo(map);
}

/* ---------------- Realtime /traps listener ---------------- */
function attachTrapListener(){
  if (!fbDB){ renderMap([]); return; }
  try {
    fbDB.ref("traps").on("value", snap => {
      try {
        const v = snap.val();
        MAP_TRAPS = v ? Object.values(v).filter(t => t && t.lat != null && t.lng != null) : [];
        renderMap(MAP_TRAPS);
      } catch(e){ console.warn("traps render", e); }
    }, err => { console.warn("traps err", err); renderMap([]); });
  } catch(e){
    console.error("attachTrapListener failed", e);
    renderMap([]);
  }
}

/* ---------------- Render traps onto map ---------------- */
function renderMap(traps){
  const emptyNote = document.getElementById("mapEmpty");
  if (emptyNote) emptyNote.hidden = traps.length > 0;

  // heat points
  heatLayer.setLatLngs(traps.map(t => [t.lat, t.lng, HEAT_INTENSITY[resolveLevel(t)]]));

  // zones + markers
  trapGroup.clearLayers();
  traps.forEach(t => {
    const lv = resolveLevel(t);

    // risk-zone circle (real meters, scales with zoom)
    const circle = window.L.circle([t.lat, t.lng], {
      radius: ZONE_RADIUS[lv],
      color: LEVELS[lv].color, weight:1.5,
      fillColor: LEVELS[lv].color, fillOpacity:0.25
    });
    circle.addTo(trapGroup);

    // small glowing marker (divIcon → CSS glow in level color)
    const L_ = LEVELS[lv];
    const marker = window.L.marker([t.lat, t.lng], {
      icon: window.L.divIcon({
        className:"trap-dot",
        html:'<span style="--c:'+L_.color+'"></span>',
        iconSize:[14,14], iconAnchor:[7,7], popupAnchor:[0,-8]
      })
    });
    const r = rocText(t.rateOfChange);
    marker.bindPopup(
      '<div class="trap-pop">' +
        '<div class="pop-name">'+escapeHtml(t.name || "กับดัก")+'</div>' +
        '<span class="pop-level" style="background:'+L_.color+';color:'+L_.on+'">'+L_.th+' / '+L_.en+'</span>' +
        '<div class="pop-row"><i data-lucide="egg"></i> ไข่ (ประมาณ): <b>'+eggRangeText(lv)+'</b></div>' +
        '<div class="pop-row"><i data-lucide="trending-up"></i> อัตราเปลี่ยนแปลง: <b>'+r.arrow+'</b></div>' +
        '<div class="pop-row"><i data-lucide="clock"></i> '+thRelative(t.ts)+'</div>' +
        '<div class="pop-reco">'+L_.recoTh+'<br><i>'+L_.recoEn+'</i></div>' +
      '</div>'
    );
    marker.addTo(trapGroup);
  });

  // summary strip — colored swatches (not emoji)
  const counts = [0,0,0,0];
  traps.forEach(t => counts[resolveLevel(t)]++);
  const strip = document.getElementById("mapCounts");
  if (strip){
    const ct = (i,label)=>
      '<span class="ct" style="color:'+LEVELS[i].color+'">' +
        '<span class="sw" style="background:'+LEVELS[i].color+'"></span>' +
        '<span style="color:var(--text-secondary)">'+label+' '+counts[i]+'</span></span>';
    strip.innerHTML = ct(3,"อันตราย") + ct(2,"เสี่ยง") + ct(1,"เฝ้าระวัง") + ct(0,"ปลอดภัย");
  }

  // recalc size in case container just became visible
  setTimeout(()=> map && map.invalidateSize(), 60);
}
