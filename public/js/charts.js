/**
 * js/charts.js
 * ─────────────────────────────────────────────────────────
 * Chart.js chart definitions and update helpers.
 *
 * Charts:
 *   1. analyticsChart — Energy kWh analysis (bar, per room)
 *                       Supports Daily / Weekly / Monthly / Yearly tabs
 *                       Role-aware: shows all rooms for admin,
 *                       only the user's room for user role.
 *                       Dynamic: supports any number of rooms.
 * ─────────────────────────────────────────────────────────
 */

// ── Shared Chart Theme ───────────────────────────────────
Chart.defaults.color            = "#8ba3c7";
Chart.defaults.borderColor      = "#1e3358";
Chart.defaults.font.family      = "'Space Mono', monospace";
Chart.defaults.font.size        = 11;

// ── Color palette for room datasets ──────────────────────
const CHART_COLORS = [
  "rgba(0,180,255,0.65)",
  "rgba(0,230,118,0.65)",
  "rgba(255,193,7,0.65)",
  "rgba(255,87,34,0.65)",
  "rgba(156,39,176,0.65)",
  "rgba(0,188,212,0.65)",
  "rgba(255,61,61,0.65)",
  "rgba(76,175,80,0.65)",
  "rgba(233,30,99,0.65)",
  "rgba(121,85,72,0.65)"
];

// ── Period metadata ──────────────────────────────────────
const PERIOD_META = {
  daily:   { title: "Daily Energy Consumption (kWh)",   dataKey: "dailyData" },
  weekly:  { title: "Weekly Energy Consumption (kWh)",  dataKey: "weeklyData" },
  monthly: { title: "Monthly Energy Consumption (kWh)", dataKey: "monthlyData" },
  yearly:  { title: "Yearly Energy Consumption (kWh)",  dataKey: "yearlyData" }
};

let currentPeriod = "daily";

// ── 1. Analytics Chart (Daily / Weekly / Monthly / Yearly) ──
let analyticsChart = null;

function initDailyChart(data) {
  const ctx = document.getElementById("chart-daily");
  if (!ctx) return;

  analyticsChart = new Chart(ctx, {
    type: "bar",
    data: buildAnalyticsData(data),
    options: {
      responsive: true,
      animation: { duration: 350 },
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 12, padding: 16 }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: "#1e3358" },
          ticks: { callback: v => v + " kWh" }
        }
      }
    }
  });
}

/**
 * Build chart datasets dynamically based on rooms in the data.
 * Supports any number of rooms (room1, room2, room3, ...).
 */
function buildAnalyticsData(data) {
  const isAdmin = (typeof IS_ADMIN !== 'undefined') ? IS_ADMIN : true;
  const userRoom = (typeof USER_ROOM !== 'undefined') ? USER_ROOM : null;

  // Discover which rooms exist in the data
  const roomIds = [];
  if (data.length > 0) {
    const sample = data[0];
    Object.keys(sample).forEach(key => {
      const match = key.match(/^room(\d+)$/);
      if (match) roomIds.push(parseInt(match[1]));
    });
    roomIds.sort((a, b) => a - b);
  }

  if (isAdmin) {
    // Admin: show all rooms
    return {
      labels: data.map(d => d.label),
      datasets: roomIds.map((id, idx) => ({
        label: `Room ${id}`,
        data: data.map(d => d[`room${id}`] || 0),
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
        borderRadius: 4
      }))
    };
  } else {
    // User: show only their room
    const color = CHART_COLORS[(userRoom - 1) % CHART_COLORS.length];
    return {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: `Room ${userRoom}`,
          data: data.map(d => d[`room${userRoom}`] || 0),
          backgroundColor: color,
          borderRadius: 4
        }
      ]
    };
  }
}

/**
 * Update analytics chart with fresh data array.
 * @param {Array} data  — [{label, room1, room2, ...}, ...]
 */
function updateDailyChart(data) {
  if (!analyticsChart) return;
  analyticsChart.data = buildAnalyticsData(data);
  analyticsChart.update();
}

/**
 * Switch the analytics chart to a different time period.
 * @param {'daily'|'weekly'|'monthly'|'yearly'} period
 */
function switchAnalyticsPeriod(period) {
  if (!analyticsChart || !DEMO || !(period in PERIOD_META)) return;
  currentPeriod = period;

  // Update active tab styling
  document.querySelectorAll(".chart-tab").forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Update chart title
  const titleEl = document.getElementById("chart-period-title");
  if (titleEl) titleEl.textContent = PERIOD_META[period].title;

  // Swap chart data with smooth animation
  const data = DEMO[PERIOD_META[period].dataKey];
  analyticsChart.data = buildAnalyticsData(data);
  analyticsChart.update();
}
