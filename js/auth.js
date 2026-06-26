/* ============================================================
   auth.js — Firebase Auth: login, signup, logout, route guard
   Shared by login.html (forms) and protected pages (guard + nav).
   ============================================================ */
"use strict";

/* ---------- Friendly Thai error messages ---------- */
function thaiAuthError(code){
  const map = {
    "auth/invalid-email":          "อีเมลไม่ถูกต้อง",
    "auth/user-disabled":          "บัญชีนี้ถูกระงับการใช้งาน",
    "auth/user-not-found":         "ไม่พบบัญชีผู้ใช้นี้",
    "auth/wrong-password":         "รหัสผ่านไม่ถูกต้อง",
    "auth/invalid-credential":     "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "auth/email-already-in-use":   "อีเมลนี้ถูกใช้สมัครแล้ว",
    "auth/weak-password":          "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)",
    "auth/missing-password":       "กรุณากรอกรหัสผ่าน",
    "auth/too-many-requests":      "พยายามมากเกินไป กรุณาลองใหม่ภายหลัง",
    "auth/network-request-failed": "เชื่อมต่อเครือข่ายไม่สำเร็จ",
    "auth/popup-closed-by-user":   "ปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จสิ้น",
    "auth/operation-not-allowed":  "ยังไม่ได้เปิดวิธีเข้าสู่ระบบนี้ใน Firebase console"
  };
  return map[code] || ("เกิดข้อผิดพลาด: " + code);
}

/* ---------- Route guard for protected pages ---------- */
/* Call on dashboard.html / map.html. Redirects to login if signed out. */
function requireAuth(onReady){
  if (!fbAuth){
    // SDK missing — send to login rather than show a broken protected page.
    window.location.replace("login.html");
    return;
  }
  fbAuth.onAuthStateChanged(user => {
    if (!user){
      window.location.replace("login.html");
    } else if (typeof onReady === "function"){
      onReady(user);
    }
  });
}

/* ---------- Render auth area in the shared nav ---------- */
/* protectedPage=true shows email + logout; otherwise shows Sign-in link. */
function renderNavAuth(protectedPage){
  const host = document.getElementById("navAuth");
  if (!host || !fbAuth) return;
  fbAuth.onAuthStateChanged(user => {
    if (user){
      host.innerHTML =
        '<span class="nav-user" title="' + escapeHtml(user.email) + '">' +
          '<span class="nav-user-dot"></span>' + escapeHtml(user.email) +
        '</span>' +
        '<button class="btn btn-ghost btn-sm" id="logoutBtn"><i data-lucide="log-out"></i> ออกจากระบบ ' +
          '<span class="en">Logout</span></button>';
      const lb = document.getElementById("logoutBtn");
      if (lb) lb.addEventListener("click", doLogout);
    } else if (!protectedPage){
      host.innerHTML =
        '<a class="btn btn-primary btn-sm" href="login.html"><i data-lucide="log-in"></i> เข้าสู่ระบบ ' +
        '<span class="en">Sign in</span></a>';
    }
    refreshIcons();
  });
}

/* ---------- Actions ---------- */
function doLogin(email, password){
  return fbAuth.signInWithEmailAndPassword(email, password);
}
function doSignup(email, password){
  return fbAuth.createUserWithEmailAndPassword(email, password);
}
function doGoogle(){
  const provider = new firebase.auth.GoogleAuthProvider();
  return fbAuth.signInWithPopup(provider);
}
function doLogout(){
  if (!fbAuth) return;
  fbAuth.signOut().then(()=> window.location.replace("login.html"))
                  .catch(e => showToast(thaiAuthError(e.code), "error"));
}

/* ---------- login.html wiring ---------- */
function initLoginPage(){
  // If already signed in, skip straight to dashboard.
  if (fbAuth){
    fbAuth.onAuthStateChanged(user => { if (user) window.location.replace("dashboard.html"); });
  }

  const tabSignin = document.getElementById("tabSignin");
  const tabSignup = document.getElementById("tabSignup");
  const form      = document.getElementById("authForm");
  const emailEl   = document.getElementById("email");
  const passEl    = document.getElementById("password");
  const submitBtn = document.getElementById("submitBtn");
  const errBox    = document.getElementById("authError");
  const titleEl   = document.getElementById("formTitle");
  const toggleEye = document.getElementById("togglePass");
  const googleBtn = document.getElementById("googleBtn");

  let mode = "signin"; // or "signup"

  function setMode(m){
    mode = m;
    const isIn = m === "signin";
    tabSignin.setAttribute("aria-selected", isIn);
    tabSignup.setAttribute("aria-selected", !isIn);
    titleEl.innerHTML = isIn
      ? 'ยินดีต้อนรับกลับ<span class="en">Welcome back</span>'
      : 'สร้างบัญชีใหม่<span class="en">Create your account</span>';
    submitBtn.innerHTML = isIn
      ? 'เข้าสู่ระบบ <span class="en">Sign in</span>'
      : 'สมัครสมาชิก <span class="en">Sign up</span>';
    errBox.hidden = true;
  }
  tabSignin.addEventListener("click", ()=> setMode("signin"));
  tabSignup.addEventListener("click", ()=> setMode("signup"));

  toggleEye.addEventListener("click", ()=>{
    const showing = passEl.type === "text";
    passEl.type = showing ? "password" : "text";
    toggleEye.innerHTML = '<i data-lucide="' + (showing ? "eye" : "eye-off") + '"></i>';
    toggleEye.setAttribute("aria-label", showing ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน");
    refreshIcons();
  });

  function busy(on){
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
  }
  function showErr(msg){
    errBox.textContent = msg;
    errBox.hidden = false;
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    errBox.hidden = true;
    const email = emailEl.value.trim();
    const pass  = passEl.value;
    if (!email){ showErr("กรุณากรอกอีเมล"); return; }
    if (!pass){ showErr("กรุณากรอกรหัสผ่าน"); return; }
    busy(true);
    const action = mode === "signin" ? doLogin(email, pass) : doSignup(email, pass);
    action
      .then(()=> window.location.replace("dashboard.html"))
      .catch(err => { busy(false); showErr(thaiAuthError(err.code)); });
  });

  if (googleBtn){
    googleBtn.addEventListener("click", ()=>{
      errBox.hidden = true;
      doGoogle()
        .then(()=> window.location.replace("dashboard.html"))
        .catch(err => showErr(thaiAuthError(err.code)));
    });
  }

  setMode("signin");
}
