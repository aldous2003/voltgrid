/**
 * js/dashboard.js
 * ─────────────────────────────────────────────────────────
 * Main dashboard controller.
 *
 * Responsibilities:
 *   - Initialise components and charts
 *   - Attach Firebase listeners (if configured)
 *   - Fall back to realistic DEMO DATA simulation
 *   - Update telemetry, room cards, event log, charts
 *   - Drive uptime counter and update counter
 *   - Role-aware: filters data based on user session
 *   - Dynamic rooms: loads room configs from localStorage
 * ─────────────────────────────────────────────────────────
 */

// ── Session / Role Detection ─────────────────────────────
const CURRENT_SESSION = (typeof VoltAuth !== 'undefined') ? VoltAuth.getSession() : null;
const IS_ADMIN = !CURRENT_SESSION || CURRENT_SESSION.role === 'admin';
const USER_ROOM = CURRENT_SESSION ? CURRENT_SESSION.room : null; // null for admin

// ── Load dynamic room configs ────────────────────────────
function loadRoomConfigs() {
  if (typeof VoltAuth !== 'undefined' && VoltAuth.getRoomConfigs) {
    return VoltAuth.getRoomConfigs();
  }
  // Fallback defaults
  return [
    { id: 1, name: "Room 1", credit: 73.20, remainingKwh: 6.80, relay: true, power: 1067.0, totalEnergy: 12.44 },
    { id: 2, name: "Room 2", credit: 18.50, remainingKwh: 1.72, relay: true, power: 0,      totalEnergy: 8.91  }
  ];
}

// ── Color palette for rooms ──────────────────────────────
const ROOM_COLORS = [
  "rgba(0,180,255,0.65)",
  "rgba(0,230,118,0.65)",
  "rgba(255,193,7,0.65)",
  "rgba(255,87,34,0.65)",
  "rgba(156,39,176,0.65)",
  "rgba(0,188,212,0.65)",
  "rgba(255,61,61,0.65)",
  "rgba(76,175,80,0.65)"
];

// ── Generate demo analytics data for a set of rooms ──────
function generateDemoAnalytics(rooms) {
  const dayLabels   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekLabels  = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yearLabels  = ["2021", "2022", "2023", "2024", "2025"];

  function buildEntries(labels, baseMin, baseMax) {
    return labels.map(label => {
      const entry = { label };
      rooms.forEach(room => {
        entry[`room${room.id}`] = +(baseMin + Math.random() * (baseMax - baseMin)).toFixed(1);
      });
      return entry;
    });
  }

  return {
    dailyData:   buildEntries(dayLabels,   1.2, 5.2),
    weeklyData:  buildEntries(weekLabels,  13, 26),
    monthlyData: buildEntries(monthLabels, 58, 115),
    yearlyData:  buildEntries(yearLabels,  800, 1250)
  };
}

// ── Demo / Simulation State ──────────────────────────────
const DEMO = {
  voltage:     220.0,
  current:     4.85,
  power:       1067.0,
  energy:      12.44,
  frequency:   60.0,
  powerFactor: 0.99,
  relay:       true,
  selectedRoom: 1,
  rooms: []
};

// Initialize rooms and analytics from stored configs
function initDemoState() {
  const configs = loadRoomConfigs();
  DEMO.rooms = configs.map(r => ({ ...r }));
  const analytics = generateDemoAnalytics(DEMO.rooms);
  DEMO.dailyData   = analytics.dailyData;
  DEMO.weeklyData  = analytics.weeklyData;
  DEMO.monthlyData = analytics.monthlyData;
  DEMO.yearlyData  = analytics.yearlyData;
}

initDemoState();

// ── Runtime State ────────────────────────────────────────
let updateCount    = 0;
let sessionStart   = Date.now();
let uptimeInterval = null;

// ── Telemetry bar max values for % calculation ───────────
const T_MAX = {
  voltage:     250,
  current:     20,
  power:       4400,
  energy:      100,
  frequency:   70,
  powerFactor: 1
};

// ── Utility: small random fluctuation ───────────────────
function fluctuate(base, range) {
  return +(base + (Math.random() - 0.5) * range).toFixed(3);
}

// ── Telemetry updater ────────────────────────────────────
function updateTelemetry(data) {
  const fields = ["voltage", "current", "power", "energy", "freq", "pf"];
  const vals = {
    voltage: data.voltage,
    current: data.current,
    power:   data.power,
    energy:  data.energy,
    freq:    data.frequency,
    pf:      data.powerFactor
  };

  for (const key of fields) {
    const el = document.getElementById(`t-${key}`);
    if (!el) continue;
    const newVal = Number(vals[key]);
    el.textContent = key === "power" ? Math.round(newVal) : newVal.toFixed(key === "pf" ? 2 : 2);

    // flash animation
    const card = el.closest(".t-card");
    if (card) {
      card.classList.add("updated");
      setTimeout(() => card.classList.remove("updated"), 600);
    }
  }

  // update progress bars
  const barKeys = {
    "bar-voltage": data.voltage     / T_MAX.voltage,
    "bar-current": data.current     / T_MAX.current,
    "bar-power":   data.power       / T_MAX.power,
    "bar-energy":  (data.energy % 10) / 10,
    "bar-freq":    data.frequency   / T_MAX.frequency,
    "bar-pf":      data.powerFactor / T_MAX.powerFactor
  };
  for (const [id, ratio] of Object.entries(barKeys)) {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = Math.min(100, Math.max(0, ratio * 100)).toFixed(1) + "%";
  }

  // increment counter
  updateCount++;
  const uc = document.getElementById("update-count");
  if (uc) uc.textContent = updateCount;
}

// ── Room cards updater ───────────────────────────────────
function updateAllRooms(rooms) {
  const grid = document.getElementById("room-grid");
  if (!grid) return;

  // Filter rooms for user role
  const filteredRooms = IS_ADMIN ? rooms : rooms.filter(r => r.id === USER_ROOM);

  let activeCount = 0;
  filteredRooms.forEach(room => {
    if (room.relay) activeCount++;
    if (document.getElementById(`room-card-${room.id}`)) {
      updateRoomCard(room);
    } else {
      grid.appendChild(createRoomCard(room));
    }
  });

  const arc = document.getElementById("active-rooms-count");
  if (arc) arc.textContent = activeCount;
}

// ── Event Log ────────────────────────────────────────────
const EVENT_ICON_MAP = {
  "relay_on":  "🟢",
  "relay_off": "🔴",
  "credit":    "💰",
  "login":     "🔑",
  "warn":      "⚠️"
};

const INITIAL_EVENTS = [
  { type: "login",     message: "Admin login — dashboard connected",       timestamp: Date.now() - 180000 },
  { type: "relay_on",  message: "Relay ON — Room 1 activated",              timestamp: Date.now() - 150000 },
  { type: "credit",    message: "Credit top-up ₱50.00 — Room 1",           timestamp: Date.now() - 120000 },
  { type: "relay_on",  message: "Relay ON — Room 2 activated",              timestamp: Date.now() - 90000  },
  { type: "warn",      message: "Low credit warning — Room 2 (₱20.00)",    timestamp: Date.now() - 30000  }
];

function formatEventTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

function addEventToLog(event) {
  const log = document.getElementById("event-log");
  if (!log) return;

  const el = document.createElement("div");
  el.className = `event-item ev-${event.type.replace("_","-")}`;
  el.innerHTML = `
    <span class="event-icon">${EVENT_ICON_MAP[event.type] || "ℹ️"}</span>
    <div class="event-body">
      <div class="event-msg">${event.message}</div>
      <div class="event-time">${formatEventTime(event.timestamp)}</div>
    </div>
  `;

  // prepend new events
  log.insertBefore(el, log.firstChild);

  // keep max 100 events
  while (log.children.length > 100) log.removeChild(log.lastChild);
}

function loadInitialEvents() {
  // load oldest → newest
  [...INITIAL_EVENTS].reverse().forEach(e => addEventToLog(e));
}

// ── Uptime counter ───────────────────────────────────────
function startUptime() {
  const el = document.getElementById("uptime-val");
  if (!el) return;
  uptimeInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - sessionStart) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");
    el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

// ── Demo simulation loop ─────────────────────────────────
let _demoTick = 0;
const RANDOM_EVENTS = [
  { type: "credit",    message: "Credit top-up ₱20.00 — Room 2" },
  { type: "warn",      message: "Low credit warning — Room 2 (₱10.00)" },
  { type: "relay_off", message: "Relay OFF — Room 2 credit depleted" },
  { type: "relay_on",  message: "Relay ON — Room 2 credit restored" },
  { type: "credit",    message: "Credit top-up ₱100.00 — Room 1" }
];
let _nextEventIndex = 0;

function runDemoSimulation() {
  // Fluctuate telemetry
  DEMO.voltage     = fluctuate(220, 4);
  DEMO.current     = fluctuate(4.85, 0.8);
  DEMO.power       = +(DEMO.voltage * DEMO.current * DEMO.powerFactor).toFixed(1);
  DEMO.energy      = +(DEMO.energy + DEMO.power / 3600000).toFixed(6);
  DEMO.frequency   = fluctuate(60, 0.3);
  DEMO.powerFactor = Math.min(1, fluctuate(0.99, 0.04));

  // Simulate all rooms dynamically
  DEMO.rooms.forEach((room, i) => {
    if (i === 0) {
      // Room 1: active with power draw
      room.power       = DEMO.power;
      room.credit      = Math.max(0, +(room.credit - DEMO.power / 3600 / 10).toFixed(4));
      room.remainingKwh= Math.max(0, +(room.credit / 10.75).toFixed(4));
      room.totalEnergy = DEMO.energy;
    } else {
      // Other rooms: slow credit drain
      room.credit      = Math.max(0, +(room.credit - 0.001).toFixed(4));
      room.remainingKwh= Math.max(0, +(room.credit / 10.75).toFixed(4));
    }
  });

  updateTelemetry({
    voltage:     DEMO.voltage,
    current:     DEMO.current,
    power:       DEMO.power,
    energy:      DEMO.energy,
    frequency:   DEMO.frequency,
    powerFactor: DEMO.powerFactor
  });
  updateAllRooms(DEMO.rooms);
  StatusIndicator.markDataReceived();

  // fire a random event every ~15 ticks (admin only has event log)
  _demoTick++;
  if (_demoTick % 15 === 0 && document.getElementById("event-log")) {
    const ev = RANDOM_EVENTS[_nextEventIndex % RANDOM_EVENTS.length];
    addEventToLog({ ...ev, timestamp: Date.now() });
    _nextEventIndex++;
  }
}

// ── Firebase listeners (used when FIREBASE_READY = true) ─
function attachFirebaseListeners() {
  // Telemetry
  listenToPath("/telemetry", data => {
    updateTelemetry(data);
    StatusIndicator.markDataReceived();
  });

  // Listen to all rooms dynamically
  DEMO.rooms.forEach(room => {
    listenToPath(`/rooms/room${room.id}`, data => {
      updateRoomCard({ id: room.id, name: room.name, ...data });
    });
  });

  // Events (admin only)
  if (IS_ADMIN) {
    listenToPath("/events", data => {
      if (!data) return;
      const events = Object.values(data).slice(-1); // newest
      events.forEach(e => addEventToLog(e));
    });
  }

  // Analytics (optional paths)
  listenToPath("/analytics/daily", data => {
    if (data) updateDailyChart(Object.values(data));
  });
}

/**
 * Reload rooms from localStorage and refresh the dashboard.
 * Called by admin panel after adding a room.
 */
function reloadDashboardRooms() {
  initDemoState();
  // Clear existing room cards
  const grid = document.getElementById("room-grid");
  if (grid) grid.innerHTML = '';
  // Re-render
  updateAllRooms(DEMO.rooms);
  // Refresh chart
  if (typeof analyticsChart !== 'undefined' && analyticsChart) {
    analyticsChart.data = buildAnalyticsData(DEMO.dailyData);
    analyticsChart.update();
  }
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Init charts (role-aware via charts.js)
  initDailyChart(DEMO.dailyData);

  // Init room cards
  updateAllRooms(DEMO.rooms);

  // Initial event log (admin only — user.html has no event-log element)
  if (document.getElementById("event-log")) {
    loadInitialEvents();
  }

  // Status indicator ticker
  StatusIndicator.startTicker();
  StatusIndicator.markDataReceived();

  // Uptime counter
  startUptime();

  if (FIREBASE_READY) {
    // Live Firebase mode
    console.info("[VoltGrid] Attaching Firebase listeners…");
    attachFirebaseListeners();
  } else {
    // Demo simulation mode
    console.info("[VoltGrid] Running DEMO simulation (2s interval).");
    runDemoSimulation();
    setInterval(runDemoSimulation, 2000);
  }
});
