# 🦟 กับดักยุงอัจฉริยะ — นับไข่ยุงลายด้วย Edge AI
**Smart Mosquito Trap · Edge AI Dengue Surveillance**

เว็บแอปเฝ้าระวังไข้เลือดออกเชิงรุก แสดงระดับความเสี่ยงจากจำนวนไข่ยุงลายที่นับด้วย AI
พร้อมแดชบอร์ดเรียลไทม์และแผนที่ความเสี่ยงทั่วประเทศไทย

โครงงานโดย **โรงเรียนวิทยาศาสตร์จุฬาภรณราชวิทยาลัย ตรัง**
(Princess Chulabhorn Science High School Trang)

---

## 📁 โครงสร้างไฟล์

```
mosquito-trap-web/
├── index.html          # หน้าแรก (แนะนำโครงงาน) — เปิดสาธารณะ
├── login.html          # เข้าสู่ระบบ / สมัครสมาชิก (Firebase Auth)
├── dashboard.html      # แดชบอร์ดกับดัก (ต้องล็อกอิน)
├── map.html            # แผนที่ความเสี่ยงทั่วไทย (ต้องล็อกอิน)
├── css/styles.css      # สไตล์รวม + ตัวแปรธีม + คอมโพเนนต์
├── js/firebase-config.js  # ตั้งค่า + เริ่มต้น Firebase ครั้งเดียว
├── js/auth.js          # ล็อกอิน/สมัคร/ออกจากระบบ + ตัวกันเส้นทาง (route guard)
├── js/data.js          # ตัวช่วยระดับความเสี่ยง, ฟอร์แมตวันที่ไทย, ค่าคงที่
├── js/dashboard.js     # ลอจิกหน้าแดชบอร์ด
├── js/map.js           # ลอจิกหน้าแผนที่ (Leaflet + heatmap)
├── js/seed.js          # ปุ่มแอดมิน: เขียนข้อมูลตัวอย่างลง Firebase จริง
└── README.md           # ไฟล์นี้
```

> **ไม่มีขั้นตอน build** เป็น HTML/CSS/JS ล้วน ใช้ Firebase v10 **compat** ผ่าน `<script>`
> เพื่อหลีกเลี่ยงปัญหา ES module/CORS เวลาเปิดผ่านเซิร์ฟเวอร์ static

---

## 1) วิธีรันในเครื่อง (Run locally)

เนื่องจากใช้ Firebase Auth ควรรันผ่านเซิร์ฟเวอร์ static (ไม่ควรเปิดไฟล์ตรง ๆ ด้วย `file://`)

**ทางเลือก A — `npx serve` (แนะนำ):**
```bash
cd mosquito-trap-web
npx serve
```
แล้วเปิดลิงก์ที่ขึ้น เช่น `http://localhost:3000`

**ทางเลือก B — Live Server ใน VS Code:**
1. ติดตั้งส่วนขยาย **Live Server**
2. คลิกขวาที่ `index.html` → **Open with Live Server**

**ทางเลือก C — Python:**
```bash
cd mosquito-trap-web
python -m http.server 5500
```
เปิด `http://localhost:5500`

> ⚠️ ต้องเพิ่มโดเมนที่ใช้ทดสอบใน Firebase Console → Authentication → Settings →
> **Authorized domains** (`localhost` มีให้อยู่แล้วโดยปริยาย)

---

## 2) วิธี Deploy

### ก. Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
cd mosquito-trap-web
firebase init hosting
#   - เลือกโปรเจกต์: mosquito-trap-bf4a7
#   - public directory: .   (จุด = โฟลเดอร์ปัจจุบัน)
#   - Single-page app?: No
#   - ไม่ต้องเขียนทับไฟล์ index.html
firebase deploy
```
จะได้โดเมน `https://mosquito-trap-bf4a7.web.app`

### ข. GitHub Pages
1. สร้าง repo แล้ว push โฟลเดอร์ `mosquito-trap-web` ขึ้นไป
   (ให้ `index.html` อยู่ที่ราก หรือในโฟลเดอร์ `/docs`)
2. **Settings → Pages** → Branch = `main`, Folder = `/ (root)` หรือ `/docs` → Save
3. ได้ลิงก์ `https://<username>.github.io/<repo>/`
4. นำลิงก์ไปใส่ใน Firebase → Authentication → **Authorized domains**

---

## 3) เปิดระบบ Authentication ใน Firebase Console

1. ไปที่ [Firebase Console](https://console.firebase.google.com/) → โปรเจกต์ **mosquito-trap-bf4a7**
2. เมนู **Build → Authentication → Get started**
3. แท็บ **Sign-in method**:
   - เปิด **Email/Password** → *Enable* → Save
   - (ทางเลือก) เปิด **Google** → ตั้งชื่อโปรเจกต์ + อีเมลสนับสนุน → Save
4. แท็บ **Settings → Authorized domains**: เพิ่มโดเมนที่ใช้งานจริง
   (`localhost`, โดเมน Hosting, โดเมน GitHub Pages)
5. สมัครบัญชีทีมได้จากหน้า `login.html` (แท็บ “สมัครสมาชิก”)
   หรือเพิ่มผู้ใช้เองในแท็บ **Users**

---

## 4) โครงสร้าง JSON ที่ ESP32/AI ต้องเขียนลง Realtime Database

`ts` = เวลา Unix หน่วย **มิลลิวินาที** · `level` = 0–3 (AI กำหนด, ถ้าไม่ส่งระบบจะคำนวณจาก `eggCount`)
· `rateOfChange` = อัตราเพิ่มเทียบครั้งก่อน (เช่น 0.8 = +80%)

**`/latest`** — ค่าล่าสุด (ใช้กับการ์ดฮีโร่บนแดชบอร์ด) — เขียนทับค่าเดิม:
```json
{ "ts": 1750900000000, "eggCount": 95, "level": 2, "rateOfChange": 0.51 }
```

**`/readings/{autoId}`** — ประวัติทุกครั้งที่ถ่าย (ใช้กราฟ 7 วัน) — ใช้ `push()`:
```json
{ "ts": 1750900000000, "eggCount": 95, "level": 2, "rateOfChange": 0.51 }
```

**`/alerts/{autoId}`** — ประวัติแจ้งเตือน Telegram — ใช้ `push()`:
```json
{ "ts": 1750900000000, "level": 2, "message": "พบไข่ยุงลาย 95 ฟอง (ระดับเสี่ยง) เพิ่มขึ้น 51% — ควรกำจัดแหล่งน้ำขัง" }
```

**`/traps/{trapId}`** — กับดักแต่ละจุดในเครือข่าย (ใช้แผนที่ heatmap):
```json
{
  "name": "ตรัง (Trang)",
  "lat": 7.559,
  "lng": 99.611,
  "eggCount": 120,
  "level": 3,
  "rateOfChange": 0.42,
  "ts": 1750900000000
}
```

### เกณฑ์ระดับความเสี่ยง (4 ระดับ)
| level | ไข่ (ฟอง) | ความหมาย | English | สี |
|---|---|---|---|---|
| 0 | 0 | ปลอดภัย | Safe | `#16A34A` |
| 1 | 1–30 | เฝ้าระวัง | Watch | `#CA8A04` |
| 2 | 31–100 | เสี่ยง | At Risk | `#EA580C` |
| 3 | 100+ | อันตราย | Danger | `#DC2626` |

- เกณฑ์แจ้งเตือน = `level ≥ 2` (ไข่ 31+ ฟอง)
- เตือนล่วงหน้าเพิ่มเมื่อ `rateOfChange ≥ 0.5` (เพิ่ม ≥ 50%) แม้ระดับยังไม่สูง

> 💡 อยากดูข้อมูลตัวอย่างทันที: ล็อกอิน → หน้าแดชบอร์ด → กดปุ่ม
> **“ใส่ข้อมูลตัวอย่าง / Seed sample data”** (มุมขวาของการ์ดแจ้งเตือน)
> ระบบจะเขียน `/readings`, `/latest`, `/alerts`, `/traps` ลง Firebase จริงให้เลย

---

## 5) ตัวอย่าง Security Rules (ล็อกให้เฉพาะผู้ที่ล็อกอิน)

ไปที่ **Realtime Database → Rules** แล้ววางค่านี้:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",

    "latest":   { ".read": "auth != null", ".write": "auth != null" },
    "readings": { ".read": "auth != null", ".write": "auth != null" },
    "alerts":   { ".read": "auth != null", ".write": "auth != null" },
    "traps":    { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

> อ่าน/เขียนได้เฉพาะผู้ที่ล็อกอินแล้ว (`auth != null`)

### กรณีอุปกรณ์ ESP32 ไม่ได้ล็อกอินแบบผู้ใช้
ทางเลือกที่ปลอดภัย:
1. ใช้ **Service Account / Admin SDK** บนฝั่งอุปกรณ์หรือ gateway (เขียนผ่านสิทธิ์แอดมิน ข้าม rules)
2. หรือสร้างบัญชีอุปกรณ์เฉพาะ แล้วให้ ESP32 ล็อกอินด้วย Email/Password ของบัญชีนั้น
3. ระหว่างพัฒนา/นำเสนอเท่านั้น อาจเปิดเขียนชั่วคราว — **อย่าใช้ในระบบจริง**:
   ```json
   { "rules": { ".read": "auth != null", ".write": true } }
   ```

---

## หมายเหตุการออกแบบ
- ภาษาไทยเป็นหลัก มีอังกฤษกำกับเป็นบรรทัดรองสำหรับกรรมการต่างชาติ
- ฟอนต์ **IBM Plex Sans Thai** · สีระดับความเสี่ยงใช้ชุดเดียวกันทุกหน้า
- รองรับมือถือ, โฟกัสคีย์บอร์ดชัดเจน, เคารพ `prefers-reduced-motion`
- ทุกการเรียก Firebase ครอบด้วย try/catch และมี empty state เสมอ ไม่ทำให้หน้าว่างเปล่า

© 2569 · จัดทำเพื่อการศึกษา / Educational project
