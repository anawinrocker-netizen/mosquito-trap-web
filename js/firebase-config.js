/* ============================================================
   firebase-config.js
   Initializes the Firebase app ONCE. All other scripts use the
   global `firebase` object (compat SDK loaded via <script> tags).
   ============================================================ */
"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyBTSgEoSrmuU8TA_j0H6rPhZ7eX7WsdLhg",
  authDomain: "mosquito-trap-bf4a7.firebaseapp.com",
  databaseURL: "https://mosquito-trap-bf4a7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mosquito-trap-bf4a7",
  storageBucket: "mosquito-trap-bf4a7.firebasestorage.app",
  messagingSenderId: "412514943748",
  appId: "1:412514943748:web:9df3d1a9ce0c1507d2c651"
};

// Initialize once. Guard against double-init (e.g. hot reload).
try {
  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (e) {
  console.error("Firebase init failed:", e);
}

// Convenience globals other scripts can rely on (may be undefined if SDK missing).
let fbAuth = null;
let fbDB = null;
try { fbAuth = firebase.auth(); } catch (e) { console.warn("auth() unavailable", e); }
try { fbDB = firebase.database(); } catch (e) { console.warn("database() unavailable", e); }
