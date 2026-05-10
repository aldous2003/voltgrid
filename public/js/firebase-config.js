/**
 * firebase-config.js
 * ─────────────────────────────────────────────────────────
 * Firebase configuration and initialization.
 *
 * SETUP:
 *   1. Go to Firebase Console → Project Settings → Your Apps
 *   2. Copy your web app config object
 *   3. Replace the placeholder values below
 *
 * The dashboard will work with DEMO DATA if Firebase is not
 * yet configured or if the connection fails.
 * ─────────────────────────────────────────────────────────
 */

// ── Firebase Configuration ──────────────────────────────
// Replace these placeholder values with your project's config
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCaZN7DZWpz210rBu6BXGHNBMLj98xls6c",
  authDomain:        "Yvoltgrid-prepaid-system.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "voltgrid-prepaid-system",
  storageBucket:     "voltgrid-prepaid-system.firebasestorage.app",
  messagingSenderId: "360745888787",
  appId:             "1:360745888787:web:fde9cb32e//a4e6c097e23e6"
};

// ── Expected Firestore / RTDB Data Structure ─────────────
//
// Realtime DB path: /telemetry
// {
//   voltage:     220.4,
//   current:     4.82,
//   power:       1061.0,
//   energy:      12.44,       // kWh accumulated
//   frequency:   60.0,
//   powerFactor: 0.99,
//   relay:       true,         // Room 1 relay state
//   selectedRoom: 1,
//   timestamp:   1700000000000
// }
//
// Realtime DB path: /rooms/room1 and /rooms/room2
// {
//   name:          "Room 1",
//   credit:        73.20,      // PHP
//   remainingKwh:  6.80,
//   relay:         true,
//   power:         1061.0,
//   totalEnergy:   12.44
// }
//
// Realtime DB path: /events  (array / ordered push)
// {
//   type:      "relay_on" | "relay_off" | "credit" | "login" | "warn",
//   message:   "Relay ON — Room 1 activated",
//   room:      1,
//   timestamp: 1700000000000
// }

// ── Firebase Init ────────────────────────────────────────
let db = null;
let FIREBASE_READY = false;

(function initFirebase() {
  const isPlaceholder = FIREBASE_CONFIG.apiKey === "YOUR_API_KEY";

  if (isPlaceholder) {
    console.warn(
      "[VoltGrid] Firebase not configured — running in DEMO MODE.\n" +
      "Edit js/firebase-config.js and replace placeholder values."
    );
    return;
  }

  try {
    // Firebase v9 compat SDK (loaded via CDN in HTML if needed)
    if (typeof firebase !== "undefined") {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
      FIREBASE_READY = true;
      console.info("[VoltGrid] Firebase connected ✓");
    }
  } catch (err) {
    console.error("[VoltGrid] Firebase init failed:", err);
  }
})();

// ── Firebase Listener Helper ─────────────────────────────
/**
 * Subscribe to a Realtime DB path.
 * Falls back silently if Firebase is not ready.
 *
 * @param {string}   path     - DB path, e.g. "/telemetry"
 * @param {Function} callback - called with snapshot.val()
 * @returns {Function} unsubscribe function
 */
function listenToPath(path, callback) {
  if (!FIREBASE_READY || !db) return () => {};
  const ref = db.ref(path);
  ref.on("value", snapshot => {
    if (snapshot.exists()) callback(snapshot.val());
  });
  return () => ref.off("value");
}

/**
 * Write a single value to the Realtime DB.
 * @param {string} path
 * @param {*}      value
 */
function writePath(path, value) {
  if (!FIREBASE_READY || !db) return;
  db.ref(path).set(value);
}

/**
 * Push an event to the events log.
 * @param {Object} event  - { type, message, room }
 */
function pushEvent(event) {
  if (!FIREBASE_READY || !db) return;
  db.ref("/events").push({
    ...event,
    timestamp: Date.now()
  });
}
