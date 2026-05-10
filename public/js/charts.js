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
 * ─────────────────────────────────────────────────────────
 */

// ── Shared Chart Theme ───────────────────────────────────
Chart.defaults.color            = "#8ba3c7";
Chart.defaults.borderColor      = "#1e3358";
Chart.defaults.font.family      = "'Space Mono', monospace";
Chart.defaults.font.size        = 11;

const CHART_GREEN  = "#00e676";
const CHART_BLUE   = "#4fc3f7";
const CHART_ACCENT = "#00b4ff";
const CHART_YELLOW = "#ffc107";
const CHART_RED    = "#ff3d3d";

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

function buildAnalyticsData(data) {
  // Determine role from global session variables (set in dashboard.js)
  const isAdmin = (typeof IS_ADMIN !== 'undefined') ? IS_ADMIN : true;
  const userRoom = (typeof USER_ROOM !== 'undefined') ? USER_ROOM : null;

  if (isAdmin) {
    // Admin: show both rooms
    return {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: "Room 1",
          data: data.map(d => d.room1),
          backgroundColor: "rgba(0,180,255,0.65)",
          borderRadius: 4
        },
        {
          label: "Room 2",
          data: data.map(d => d.room2),
          backgroundColor: "rgba(0,230,118,0.65)",
          borderRadius: 4
        }
      ]
    };
  } else {
    // User: show only their room
    const roomKey = `room${userRoom}`;
    const roomLabel = `Room ${userRoom}`;
    const color = userRoom === 1 ? "rgba(0,180,255,0.65)" : "rgba(0,230,118,0.65)";

    return {
      labels: data.map(d => d.label),
      datasets: [
        {
          label: roomLabel,
          data: data.map(d => d[roomKey]),
          backgroundColor: color,
          borderRadius: 4
        }
      ]
    };
  }
}

/**
 * Update analytics chart with fresh data array.
 * @param {Array} data  — [{label, room1, room2}, ...]
 */
function updateDailyChart(data) {
  if (!analyticsChart) return;
  analyticsChart.data = buildAnalyticsData(data);
  analyticsChart.update();
}

/**
 * Switch the analytics chart to a different time period.
 * Called by the tab buttons in dashboard.html.
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
