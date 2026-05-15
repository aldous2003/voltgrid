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
    { id: 2, name: "Room 2", credit: 18.50, remainingKwh: 1.72, relay: true, power: 0, totalEnergy: 8.91 }
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

// ── 24H Hourly Analytics Storage ────────────────────────
const HOURLY_KEY = "voltgrid_hourly";
const ARCHIVE_KEY = "voltgrid_daily_archive";

/**
 * Load or create today's hourly energy log.
 * Structure: { date: "YYYY-MM-DD", hours: [{label:"00:00", room1:0, room2:0, ...}, ...x24] }
 */
function getTodayHourly(rooms) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(HOURLY_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.date === today) return stored;
      // It's a new day — archive yesterday's data first
      archiveDailyData(stored, rooms);
    }
  } catch { /* ignore */ }
  // Create a fresh 24-slot structure for today
  return buildEmptyHourly(today, rooms);
}

function buildEmptyHourly(date, rooms) {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const entry = { label: String(h).padStart(2, "0") + ":00" };
    rooms.forEach(r => { entry[`room${r.id}`] = 0; });
    return entry;
  });
  return { date, hours };
}

/**
 * Persist the current accumulated kWh value for the current hour.
 * Called from the simulation loop every tick.
 */
function saveCurrentHour(rooms) {
  const h = new Date().getHours();
  if (!DEMO.hourlyData) return;
  rooms.forEach(r => {
    DEMO.hourlyData.hours[h][`room${r.id}`] = +(r.totalEnergy * 0.01).toFixed(4);
  });
  localStorage.setItem(HOURLY_KEY, JSON.stringify(DEMO.hourlyData));
}

/**
 * Move yesterday's hourly totals into the daily archive keyed by date.
 * The dailyData array is then updated to include that archived day's total.
 */
function archiveDailyData(hourlyRecord, rooms) {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    const archive = raw ? JSON.parse(raw) : {};
    // Sum each room's total for the day
    const daySummary = { label: hourlyRecord.date, hourly: hourlyRecord.hours };
    rooms.forEach(r => {
      daySummary[`room${r.id}`] = +hourlyRecord.hours
        .reduce((sum, h) => sum + (h[`room${r.id}`] || 0), 0).toFixed(2);
    });
    archive[hourlyRecord.date] = daySummary;
    // Keep max 90 days
    const keys = Object.keys(archive).sort();
    if (keys.length > 90) delete archive[keys[0]];
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch { /* ignore */ }
}

/**
 * Build the dailyData from the archive (last 7 days).
 */
function buildDailyFromArchive(rooms) {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return null;
    const archive = JSON.parse(raw);
    const days = Object.keys(archive).sort().slice(-7);
    if (days.length === 0) return null;
    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const results = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = DAY_NAMES[d.getDay()];

      const entry = { label: dayName };
      if (archive[dateStr]) {
        rooms.forEach(r => { entry[`room${r.id}`] = archive[dateStr][`room${r.id}`] || 0; });
        entry._archive = archive[dateStr].hourly;
      } else {
        rooms.forEach(r => { entry[`room${r.id}`] = 0; });
      }
      results.push(entry);
    }
    return results;
  } catch { return null; }
}

// ── Generate demo analytics data for a set of rooms ──────
function generateDemoAnalytics(rooms) {
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const weekLabels = ["Week 1", "Week 2", "Week 3", "Week 4"];
  const monthLabels = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  // Dynamic year labels: always start from 2026 (or current year, whichever is later)
  const startYear = Math.max(2026, new Date().getFullYear());
  const yearLabels = Array.from({ length: 5 }, (_, i) => String(startYear + i));

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
    dailyData: buildEntries(dayLabels, 1.2, 5.2),
    weeklyData: buildEntries(weekLabels, 13, 26),
    monthlyData: buildEntries(monthLabels, 58, 115),
    yearlyData: buildEntries(yearLabels, 800, 1250)
  };
}

// ── Demo / Simulation State ──────────────────────────────
const DEMO = {
  voltage: 220.0,
  current: 4.85,
  power: 1067.0,
  energy: 12.44,
  frequency: 60.0,
  powerFactor: 0.99,
  relay: true,
  solarRelay: true,
  selectedRoom: 1,
  rooms: [],
  solar: 450,
  solarVoltage: 220.0,
  solarEnergy: 5.24,
  grid: 617,
  gridVoltage: 220.0,
  gridEnergy: 7.20
};

// Initialize rooms and analytics from stored configs
function initDemoState() {
  const configs = loadRoomConfigs();
  DEMO.rooms = configs.map(r => ({ ...r }));
  const analytics = generateDemoAnalytics(DEMO.rooms);
  // Try to load real archived daily data; fall back to generated demo data
  DEMO.dailyData = buildDailyFromArchive(DEMO.rooms) || analytics.dailyData;
  DEMO.weeklyData = analytics.weeklyData;
  DEMO.monthlyData = analytics.monthlyData;
  DEMO.yearlyData = analytics.yearlyData;
  // 24H hourly: load or create for today
  DEMO.hourlyData = getTodayHourly(DEMO.rooms);
}

initDemoState();


// ── Runtime State ────────────────────────────────────────
let updateCount = 0;
let sessionStart = Date.now();
let uptimeInterval = null;

// ── Telemetry bar max values for % calculation ───────────
const T_MAX = {
  voltage: 250,
  current: 20,
  power: 4400,
  energy: 100,
  frequency: 70,
  powerFactor: 1,
  solar: 2000,
  grid: 4400
};

// ── Utility: small random fluctuation ───────────────────
function fluctuate(base, range) {
  return +(base + (Math.random() - 0.5) * range).toFixed(3);
}

// ── Telemetry updater ────────────────────────────────────
function updateTelemetry(data) {
  const fields = ["voltage", "current", "power", "energy", "freq", "pf", "solar", "solar-v", "solar-e", "grid", "grid-v", "grid-e"];
  const vals = {
    voltage: data.voltage,
    current: data.current,
    power: data.power,
    energy: data.energy,
    freq: data.frequency,
    pf: data.powerFactor,
    solar: data.solar,
    "solar-v": data.solarVoltage,
    "solar-e": data.solarEnergy,
    grid: data.grid,
    "grid-v": data.gridVoltage,
    "grid-e": data.gridEnergy
  };

  for (const key of fields) {
    const el = document.getElementById(`t-${key}`);
    if (!el) continue;
    const newVal = Number(vals[key]);
    if (key.includes("power") || key === "solar" || key === "grid") {
      el.textContent = Math.round(newVal);
    } else if (key.includes("-e") || key === "energy") {
      el.textContent = newVal.toFixed(2);
    } else {
      el.textContent = newVal.toFixed(key === "pf" ? 2 : 1);
    }

    // flash animation
    const card = el.closest(".t-card");
    if (card) {
      card.classList.add("updated");
      setTimeout(() => card.classList.remove("updated"), 600);
    }
  }

  // update progress bars
  const barKeys = {
    "bar-voltage": data.voltage / T_MAX.voltage,
    "bar-current": data.current / T_MAX.current,
    "bar-power": data.power / T_MAX.power,
    "bar-energy": (data.energy % 10) / 10,
    "bar-freq": data.frequency / T_MAX.frequency,
    "bar-pf": data.powerFactor / T_MAX.powerFactor,
    "bar-solar": data.solar / T_MAX.solar,
    "bar-grid": data.grid / T_MAX.grid
  };
  for (const [id, ratio] of Object.entries(barKeys)) {
    const bar = document.getElementById(id);
    if (bar) bar.style.width = Math.min(100, Math.max(0, ratio * 100)).toFixed(1) + "%";
  }

  // Update solar relay indicator and buttons
  const solarDot = document.getElementById("solar-relay-dot");
  if (solarDot) {
    solarDot.className = `source-state-badge ${DEMO.solarRelay ? 'source-state-on' : 'source-state-off'}`;
    solarDot.textContent = DEMO.solarRelay ? 'RELAY ON' : 'RELAY OFF';
    const solarCard = document.getElementById("tc-solar");
    if (solarCard) {
      solarCard.classList.toggle("relay-on", DEMO.solarRelay);
      solarCard.classList.toggle("relay-off", !DEMO.solarRelay);
    }
  }
  const btnOn = document.getElementById("solar-btn-on");
  const btnOff = document.getElementById("solar-btn-off");
  if (btnOn && btnOff) {
    btnOn.className = `src-btn ${DEMO.solarRelay ? 'active-on' : ''}`;
    btnOff.className = `src-btn ${!DEMO.solarRelay ? 'active-off' : ''}`;
  }

  const gridLiveBadge = document.getElementById("grid-live-badge");
  if (gridLiveBadge) {
    gridLiveBadge.className = `source-state-badge ${DEMO.solarRelay ? 'source-state-live' : 'source-state-on'}`;
  }
  const gridCard = document.getElementById("tc-grid");
  if (gridCard) {
    const gridShouldLight = !DEMO.solarRelay;
    gridCard.classList.toggle("source-lit", gridShouldLight);
    gridCard.classList.toggle("source-dim", !gridShouldLight);
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
  "relay_on": "ON",
  "relay_off": "OFF",
  "credit": "CR",
  "login": "LOG",
  "warn": "WARN"
};

const INITIAL_EVENTS = [
  { type: "login", message: "Admin login — dashboard connected", roomId: null, timestamp: Date.now() - 180000 },
  { type: "relay_on", message: "Relay ON — Room 1 activated", roomId: 1, timestamp: Date.now() - 150000 },
  { type: "credit", message: "Credit top-up ₱50.00 — Room 1", roomId: 1, timestamp: Date.now() - 120000 },
  { type: "relay_on", message: "Relay ON — Room 2 activated", roomId: 2, timestamp: Date.now() - 90000 },
  { type: "warn", message: "Low credit warning — Room 2 (₱20.00)", roomId: 2, timestamp: Date.now() - 30000 }
];

function formatEventTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function formatEventDateTime(ts) {
  const dateStr = new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
  return `${dateStr} - ${formatEventTime(ts)}`;
}

function buildEventElement(event) {
  const el = document.createElement("div");
  el.className = `event-item ev-${event.type.replace("_", "-")}`;
  el.innerHTML = `
    <span class="event-icon">${EVENT_ICON_MAP[event.type] || "INFO"}</span>
    <div class="event-body">
      <div class="event-msg">${event.message}</div>
      <div class="event-time">${formatEventDateTime(event.timestamp)}</div>
      <div class="event-details">
        <div>Type: ${event.type}</div>
        <div>Room: ${event.roomId === null || event.roomId === undefined ? "System" : `Room ${event.roomId}`}</div>
        <div>Date: ${formatEventDateTime(event.timestamp)}</div>
      </div>
    </div>
  `;
  return el;
}

function renderEventToDOM(event) {
  const log = document.getElementById("event-log");
  const previewLog = document.getElementById("event-log-preview");
  if (!log && !previewLog) return;

  // If we're a user, only show our own logs and system logs
  if (!IS_ADMIN && event.roomId !== null && event.roomId !== USER_ROOM) return;

  if (log) {
    log.insertBefore(buildEventElement(event), log.firstChild);
    while (log.children.length > 100) log.removeChild(log.lastChild);
  }
  if (previewLog) {
    previewLog.insertBefore(buildEventElement(event), previewLog.firstChild);
    while (previewLog.children.length > 12) previewLog.removeChild(previewLog.lastChild);
  }
}

function initTransactionLogToggle() {
  const toggleBtn = document.getElementById("tx-log-toggle");
  const closeBtn = document.getElementById("tx-log-close");
  const overlay = document.getElementById("tx-log-overlay");
  const logWrap = document.getElementById("event-log-wrap");
  if (!toggleBtn || !closeBtn || !overlay || !logWrap) return;

  const openOverlay = () => {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
  };

  const closeOverlay = () => {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
  };

  toggleBtn.addEventListener("click", openOverlay);
  closeBtn.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      closeOverlay();
    }
  });
}

function addEventToLog(event) {
  if (typeof VoltAuth !== 'undefined' && VoltAuth.logEvent) {
    VoltAuth.logEvent(event.type, event.message, event.roomId || null);
  }
  // We need to pass the actual event back out, but VoltAuth.logEvent saves the timestamp.
  // We will just render it locally with current timestamp.
  event.timestamp = event.timestamp || Date.now();
  renderEventToDOM(event);
}

function loadInitialEvents() {
  if (typeof VoltAuth !== 'undefined' && VoltAuth.getLogs) {
    let logs = VoltAuth.getLogs();
    if (logs.length === 0) {
      INITIAL_EVENTS.forEach(e => VoltAuth.logEvent(e.type, e.message, e.roomId));
      logs = VoltAuth.getLogs();
    }
    // render oldest → newest (renderEventToDOM prepends, so newest ends up at top)
    logs.forEach(e => renderEventToDOM(e));
  } else {
    INITIAL_EVENTS.forEach(e => renderEventToDOM(e));
  }
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
  { type: "credit", message: "Coin Insert ₱5.00 — Room 2", roomId: 2 },
  { type: "warn", message: "Low credit warning — Room 2 (₱10.00)", roomId: 2 },
  { type: "credit", message: "Coin Insert ₱10.00 — Room 1", roomId: 1 },
  { type: "relay_on", message: "Relay ON — Room 2 credit restored", roomId: 2 },
  { type: "credit", message: "Credit top-up ₱100.00 — Room 1", roomId: 1 }
];
let _nextEventIndex = 0;

function runDemoSimulation() {
  // Fluctuate telemetry
  DEMO.voltage = fluctuate(220, 4);
  DEMO.current = fluctuate(4.85, 0.8);
  DEMO.power = +(DEMO.voltage * DEMO.current * DEMO.powerFactor).toFixed(1);
  DEMO.energy = +(DEMO.energy + DEMO.power / 3600000).toFixed(6);
  DEMO.frequency = fluctuate(60, 0.3);
  DEMO.powerFactor = Math.min(1, fluctuate(0.99, 0.04));

  // Solar / Grid Simulation
  if (DEMO.solarRelay) {
    DEMO.solar = fluctuate(450, 40);
    DEMO.solarVoltage = fluctuate(220, 2);
    DEMO.solarEnergy = +(DEMO.solarEnergy + DEMO.solar / 3600000).toFixed(6);
  } else {
    DEMO.solar = 0;
    DEMO.solarVoltage = 0;
  }

  DEMO.grid = Math.max(0, +(DEMO.power - DEMO.solar).toFixed(1));
  DEMO.gridVoltage = DEMO.voltage; // Grid matches main voltage
  DEMO.gridEnergy = +(DEMO.gridEnergy + DEMO.grid / 3600000).toFixed(6);

  // Simulate all rooms dynamically
  DEMO.rooms.forEach((room, i) => {
    if (i === 0) {
      // Room 1: active with power draw
      room.power = DEMO.power;
      room.voltage = DEMO.voltage;
      room.credit = Math.max(0, +(room.credit - DEMO.power / 3600 / 10).toFixed(4));
      room.remainingKwh = Math.max(0, +(room.credit / 10.75).toFixed(4));
      room.totalEnergy = DEMO.energy;
    } else {
      // Other rooms: slow credit drain
      room.voltage = DEMO.voltage;
      room.credit = Math.max(0, +(room.credit - 0.001).toFixed(4));
      room.remainingKwh = Math.max(0, +(room.credit / 10.75).toFixed(4));
    }

    if (room.credit <= 0 && room.relay) {
      room.relay = false;
      if (typeof VoltAuth !== 'undefined' && VoltAuth.updateRoomConfig) {
        VoltAuth.updateRoomConfig(room.id, { relay: false });
      }
      addEventToLog({ type: "relay_off", message: `Power cutoff event — Room ${room.id} credit depleted`, roomId: room.id });
    }
  });

  updateTelemetry({
    voltage: DEMO.voltage,
    current: DEMO.current,
    power: DEMO.power,
    energy: DEMO.energy,
    frequency: DEMO.frequency,
    powerFactor: DEMO.powerFactor,
    solar: DEMO.solar,
    solarVoltage: DEMO.solarVoltage,
    solarEnergy: DEMO.solarEnergy,
    grid: DEMO.grid,
    gridVoltage: DEMO.gridVoltage,
    gridEnergy: DEMO.gridEnergy
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

  // Save current hour's kWh data every 30 ticks (~30 s)
  if (_demoTick % 30 === 0) {
    saveCurrentHour(DEMO.rooms);

    // MIDNIGHT CHECK: If the date has changed while the app is running
    const today = new Date().toISOString().slice(0, 10);
    if (DEMO.hourlyData && DEMO.hourlyData.date !== today) {
      console.info("[VoltGrid] Midnight detected. Archiving yesterday's data...");
      archiveDailyData(DEMO.hourlyData, DEMO.rooms);
      // Reset for new day
      DEMO.hourlyData = buildEmptyHourly(today, DEMO.rooms);
      localStorage.setItem(HOURLY_KEY, JSON.stringify(DEMO.hourlyData));
      // Re-build daily data to include the newly archived day
      DEMO.dailyData = buildDailyFromArchive(DEMO.rooms) || generateDemoAnalytics(DEMO.rooms).dailyData;
    }

    // If user is on the 24H tab, refresh the chart live
    if (typeof currentPeriod !== 'undefined' && currentPeriod === '24h') {
      if (typeof updateDailyChart === 'function') {
        updateDailyChart(DEMO.hourlyData.hours);
      }
    }
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

// ── Global Handlers for Admin Panel ──────────────────────
window.adminUpdateCredit = function (roomId, amount) {
  const room = DEMO.rooms.find(r => r.id === roomId);
  if (!room) return false;

  room.credit = +(room.credit + amount).toFixed(4);
  room.remainingKwh = +(room.credit / 10.75).toFixed(4);

  if (typeof VoltAuth !== 'undefined' && VoltAuth.updateRoomConfig) {
    VoltAuth.updateRoomConfig(roomId, { credit: room.credit, remainingKwh: room.remainingKwh });
  }

  updateAllRooms(DEMO.rooms);
  if (amount > 0) {
    addEventToLog({ type: 'credit', message: `Admin topped up ₱${amount.toFixed(2)} — Room ${roomId}`, roomId });
  } else {
    addEventToLog({ type: 'warn', message: `Admin deducted ₱${Math.abs(amount).toFixed(2)} — Room ${roomId}`, roomId });
  }
  return true;
};

window.adminSetRelay = function (roomId, state) {
  const room = DEMO.rooms.find(r => r.id === roomId);
  if (!room) return false;

  room.relay = state;

  if (typeof VoltAuth !== 'undefined' && VoltAuth.updateRoomConfig) {
    VoltAuth.updateRoomConfig(roomId, { relay: room.relay });
  }

  updateAllRooms(DEMO.rooms);
  const stateStr = state ? 'ON' : 'OFF';
  addEventToLog({ type: state ? 'relay_on' : 'relay_off', message: `Admin forced Relay ${stateStr} — Room ${roomId}`, roomId });
  return true;
};

// ── Solar Relay Control ──────────────────────────────────
window.handleSolarRelay = function (state) {
  DEMO.solarRelay = state;
  addEventToLog({
    type: state ? "relay_on" : "relay_off",
    message: `Solar Source Override: ${state ? 'ENABLED' : 'DISABLED'}`,
    roomId: null
  });
  return true;
};

// ── Initialise ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Init charts (role-aware via charts.js)
  initDailyChart(DEMO.hourlyData.hours);
  switchAnalyticsPeriod('24h');

  // Init room cards
  updateAllRooms(DEMO.rooms);

  // Initial event log (admin only — user.html has no event-log element)
  if (document.getElementById("event-log")) {
    initTransactionLogToggle();
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
