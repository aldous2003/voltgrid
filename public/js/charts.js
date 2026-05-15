/**
 * js/charts.js
 * ─────────────────────────────────────────────────────────
 * Chart.js chart definitions and update helpers.
 *
 * Charts:
 *   1. analyticsChart — Energy kWh analysis (bar, per room)
 *                       Supports 24H / Daily / Weekly / Monthly / Yearly tabs
 *                       Role-aware: shows all rooms for admin,
 *                       only the user's room for user role.
 *                       Dynamic: supports any number of rooms.
 *                       24H: shows live hourly data; Daily bars are
 *                       clickable to drill-down into that day's hourly data.
 * ─────────────────────────────────────────────────────────
 */

// ── Shared Chart Theme ───────────────────────────────────
Chart.defaults.color = "#8ba3c7";
Chart.defaults.borderColor = "#1e3358";
Chart.defaults.font.family = "'Calibri', 'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
Chart.defaults.font.size = 11;

// ── Color palette for room datasets ──────────────────────
const CHART_COLORS = [
  "rgba(0,180,255,0.85)",
  "rgba(0,230,118,0.85)",
  "rgba(255,193,7,0.85)",
  "rgba(255,87,34,0.85)",
  "rgba(156,39,176,0.85)",
  "rgba(0,188,212,0.85)",
  "rgba(255,61,61,0.85)",
  "rgba(76,175,80,0.85)",
  "rgba(233,30,99,0.85)",
  "rgba(121,85,72,0.85)"
];

// ── Period metadata ──────────────────────────────────────
const PERIOD_META = {
  "24h": { title: "24H (Hourly Breakdown)", dataKey: null },
  daily: { title: "Daily (Monday - Sunday)", dataKey: "dailyData" },
  weekly: { title: "Weekly (Week 1 - week 4)", dataKey: "weeklyData" },
  monthly: { title: "Monthly (January - December)", dataKey: "monthlyData" },
  yearly: { title: "Yearly (Year 2026 onwards)", dataKey: "yearlyData" }
};

let currentPeriod = "24h";

// ── State for drill-down ─────────────────────────────────
let _drillDownDate = null; // null = not drilling, "YYYY-MM-DD" = showing that day hourly

// ── 1. Analytics Chart ──────────────────────────────────
let analyticsChart = null;

// ── Custom Crosshair Plugin ──────────────────────────────
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw: (chart) => {
    if (chart.crosshairX && chart.crosshairY) {
      const { ctx } = chart;
      const { top, bottom, left, right } = chart.chartArea;
      const x = chart.crosshairX;
      const y = chart.crosshairY;

      // Only draw if within chart area
      if (x >= left && x <= right && y >= top && y <= bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)';

        // Vertical line
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);

        // Horizontal line
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);

        ctx.stroke();
        ctx.restore();
      }
    }
  }
};

function initDailyChart(data) {
  const ctx = document.getElementById("chart-daily");
  if (!ctx) return;

  analyticsChart = new Chart(ctx, {
    type: "line",
    data: buildAnalyticsData(data),
    plugins: [crosshairPlugin],
    options: {
      responsive: true,
      animation: { duration: 350 },
      interaction: {
        mode: 'nearest',
        intersect: true,
      },
      onHover: (event, elements, chart) => {
        if (event.x !== undefined && event.y !== undefined) {
          chart.crosshairX = event.x;
          chart.crosshairY = event.y;
          chart.draw();
        }
      },
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 12, padding: 16 }
        },
        tooltip: {
          enabled: true,
          animation: false,
          position: 'nearest',
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(3)} kWh`
          }
        }
      },
      scales: {
        x: {
          type: 'category',
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#1e3358" },
          ticks: { callback: v => v + " kWh" }
        }
      },
      onClick: (evt, elements) => {
        if (currentPeriod === 'daily' && elements.length > 0) {
          const index = elements[0].index;
          const entry = DEMO.dailyData[index];
          if (entry && entry._archive) {
            // Drill into this day's hourly data
            _drillDownDate = entry.label;
            const titleEl = document.getElementById("chart-period-title");
            if (titleEl) titleEl.textContent = `Hourly Breakdown — ${entry.label}`;
            analyticsChart.data = buildAnalyticsData(entry._archive);
            analyticsChart.update();
            // Show back button
            const backBtn = document.getElementById("chart-back-btn");
            if (backBtn) backBtn.style.display = "inline-flex";
          }
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

  const safeData = data || [];
  // Discover which rooms exist in the data
  const roomIds = [];
  if (safeData.length > 0) {
    const sample = safeData[0];
    Object.keys(sample).forEach(key => {
      const match = key.match(/^room(\d+)$/);
      if (match) roomIds.push(parseInt(match[1]));
    });
    roomIds.sort((a, b) => a - b);
  }

  // Ensure labels are always strings
  const labels = safeData.map(d => String(d.label || ""));

  if (isAdmin) {
    // Admin: show all rooms
    return {
      labels: labels,
      datasets: roomIds.map((id, idx) => ({
        label: `Room ${id}`,
        data: safeData.map(d => d[`room${id}`] || 0),
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#fff"
      }))
    };
  } else {
    // User: show only their room
    const color = CHART_COLORS[(userRoom - 1) % CHART_COLORS.length];
    return {
      labels: labels,
      datasets: [
        {
          label: `Room ${userRoom}`,
          data: safeData.map(d => d[`room${userRoom}`] || 0),
          backgroundColor: color,
          borderColor: color,
          borderWidth: 2.5,
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: color,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#fff"
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
 * @param {'24h'|'daily'|'weekly'|'monthly'|'yearly'} period
 */
function switchAnalyticsPeriod(period) {
  if (!analyticsChart || !DEMO || !(period in PERIOD_META)) return;
  currentPeriod = period;
  _drillDownDate = null;

  // Update active tab styling
  document.querySelectorAll(".chart-tab").forEach(btn => {
    const isActive = btn.dataset.period === period;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Update chart title
  const titleEl = document.getElementById("chart-period-title");
  if (titleEl) titleEl.textContent = PERIOD_META[period].title;

  // Hide back button
  const backBtn = document.getElementById("chart-back-btn");
  if (backBtn) backBtn.style.display = "none";

  // Swap chart data
  let data;
  if (period === '24h') {
    data = (DEMO.hourlyData && DEMO.hourlyData.hours) ? DEMO.hourlyData.hours : [];
    // Highlight the current hour's bar
    analyticsChart.options.scales.x.ticks.callback = function (val, idx) {
      const now = new Date().getHours();
      const label = data[idx] ? data[idx].label : "";
      return idx === now ? `▶ ${label}` : label;
    };
  } else {
    data = DEMO[PERIOD_META[period].dataKey];
    // Remove custom callback to show default labels from the data object
    delete analyticsChart.options.scales.x.ticks.callback;
  }

  const newData = buildAnalyticsData(data);
  analyticsChart.data.labels = newData.labels;
  analyticsChart.data.datasets = newData.datasets;
  analyticsChart.update();
}

/**
 * Go back from a drill-down view to the daily chart.
 */
function chartDrillBack() {
  if (!analyticsChart) return;
  _drillDownDate = null;
  currentPeriod = 'daily';

  document.querySelectorAll(".chart-tab").forEach(btn => {
    const isActive = btn.dataset.period === 'daily';
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const titleEl = document.getElementById("chart-period-title");
  if (titleEl) titleEl.textContent = PERIOD_META.daily.title;

  const backBtn = document.getElementById("chart-back-btn");
  if (backBtn) backBtn.style.display = "none";

  analyticsChart.options.scales.x.ticks.callback = null;
  analyticsChart.data = buildAnalyticsData(DEMO.dailyData);
  analyticsChart.update();
}
