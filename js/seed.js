/* ============================================================
   seed.js — admin helper: write REAL sample data to Firebase
   Triggered by the "ใส่ข้อมูลตัวอย่าง / Seed sample data" button on
   the dashboard. Writes /readings, /latest, /alerts, /traps so the
   team can preview and record a demo video with live data.
   ============================================================ */
"use strict";

const SEED_EGGS = [2, 8, 19, 28, 41, 63, 95]; // 7 days trending up

const SEED_TRAPS = [
  { name:"ตรัง (Trang)",          lat:7.559,  lng:99.611,  eggCount:120, level:3, rateOfChange:0.42 },
  { name:"หาดใหญ่ สงขลา (Hat Yai)", lat:7.008,  lng:100.476, eggCount:78,  level:2, rateOfChange:0.30 },
  { name:"สุราษฎร์ธานี (Surat)",   lat:9.140,  lng:99.333,  eggCount:64,  level:2, rateOfChange:0.18 },
  { name:"ภูเก็ต (Phuket)",        lat:7.880,  lng:98.392,  eggCount:52,  level:2, rateOfChange:0.25 },
  { name:"กรุงเทพฯ (Bangkok)",     lat:13.756, lng:100.501, eggCount:69,  level:2, rateOfChange:0.40 },
  { name:"ขอนแก่น (Khon Kaen)",    lat:16.441, lng:102.836, eggCount:21,  level:1, rateOfChange:0.10 },
  { name:"อุบลราชธานี (Ubon)",     lat:15.244, lng:104.847, eggCount:14,  level:1, rateOfChange:0.05 },
  { name:"เชียงใหม่ (Chiang Mai)", lat:18.788, lng:98.985,  eggCount:8,   level:1, rateOfChange:0.00 },
  { name:"นครราชสีมา (Korat)",     lat:14.979, lng:102.098, eggCount:0,   level:0, rateOfChange:0.00 },
  { name:"เชียงราย (Chiang Rai)",  lat:19.910, lng:99.840,  eggCount:0,   level:0, rateOfChange:0.00 }
];

async function seedSampleData(){
  if (!fbDB){
    showToast("ยังไม่ได้เชื่อมต่อ Firebase", "error");
    return;
  }
  if (!window.confirm(
    "ยืนยันการใส่ข้อมูลตัวอย่างลงฐานข้อมูลจริง?\n" +
    "Write sample data to the real Firebase database?\n\n" +
    "(จะเขียนทับ /latest, /readings, /alerts, /traps)"
  )) return;

  const btn = document.getElementById("seedBtn");
  if (btn){ btn.disabled = true; btn.classList.add("loading"); }

  try {
    const dayMs = 86400000;
    const now = Date.now();

    // ---- /readings (7 days) + /latest ----
    const readingsRef = fbDB.ref("readings");
    await readingsRef.remove(); // clean slate for the demo
    let latestReading = null;
    for (let i = 0; i < SEED_EGGS.length; i++){
      const ec   = SEED_EGGS[i];
      const prev = i > 0 ? SEED_EGGS[i-1] : ec;
      const roc  = prev > 0 ? +( (ec - prev) / prev ).toFixed(2) : 0;
      const reading = {
        ts: now - (SEED_EGGS.length - 1 - i) * dayMs,
        eggCount: ec,
        level: levelFromEggs(ec),
        rateOfChange: roc
      };
      await readingsRef.push(reading);
      latestReading = reading;
    }
    await fbDB.ref("latest").set(latestReading);

    // ---- /alerts (high days) ----
    const alertsRef = fbDB.ref("alerts");
    await alertsRef.remove();
    let alertCount = 0;
    for (let i = 0; i < SEED_EGGS.length && alertCount < 3; i++){
      const ec   = SEED_EGGS[i];
      const lv   = levelFromEggs(ec);
      const prev = i > 0 ? SEED_EGGS[i-1] : ec;
      const roc  = prev > 0 ? (ec - prev) / prev : 0;
      if (lv >= 2 || roc >= ROC_ALERT){
        const L = LEVELS[lv];
        await alertsRef.push({
          ts: now - (SEED_EGGS.length - 1 - i) * dayMs,
          level: lv,
          message: `พบไข่ยุงลาย ${ec} ฟอง (ระดับ${L.th}) อัตราเพิ่มขึ้น ${Math.round(roc*100)}% — ${L.recoTh}`
        });
        alertCount++;
      }
    }

    // ---- /traps ----
    const trapsRef = fbDB.ref("traps");
    await trapsRef.remove();
    for (const t of SEED_TRAPS){
      await trapsRef.push(Object.assign({ ts: Date.now() }, t));
    }

    showToast("ใส่ข้อมูลตัวอย่างสำเร็จ ✓ / Sample data written", "success");
  } catch (e){
    console.error("seed failed", e);
    showToast("ใส่ข้อมูลไม่สำเร็จ: " + (e.code || e.message), "error");
  } finally {
    if (btn){ btn.disabled = false; btn.classList.remove("loading"); }
  }
}
