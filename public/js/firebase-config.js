const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCaZN7DZWpz210rBu6BXGHNBMLj98xls6c",
  authDomain: "voltgrid-prepaid-system.firebaseapp.com",
  databaseURL: "https://voltgrid-prepaid-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "voltgrid-prepaid-system",
  storageBucket: "voltgrid-prepaid-system.firebasestorage.app",
  messagingSenderId: "360745888787",
  appId: "1:360745888787:web:fde9cb32ea4e6c097e23e6"
};

let db = null;
let FIREBASE_READY = false;

(function initFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
      db = firebase.database();
      FIREBASE_READY = true;
      console.info("[VoltGrid] Firebase connected");
    } else {
      console.error("[VoltGrid] Firebase SDK not loaded.");
    }
  } catch (err) {
    console.error("[VoltGrid] Firebase init failed:", err);
  }
})();

function listenToPath(path, callback) {
  if (!FIREBASE_READY || !db) return () => {};

  const cleanPath = path.startsWith("/") ? path : "/" + path;
  const ref = db.ref(cleanPath);

  ref.on("value", snapshot => {
    callback(snapshot.val());
  });

  return () => ref.off("value");
}

function writePath(path, value) {
  if (!FIREBASE_READY || !db) return Promise.reject("Firebase not ready");

  const cleanPath = path.startsWith("/") ? path : "/" + path;
  return db.ref(cleanPath).set(value);
}

function pushEvent(event) {
  if (!FIREBASE_READY || !db) return Promise.reject("Firebase not ready");

  return db.ref("/events").push({
    ...event,
    timestamp: Date.now()
  });
}