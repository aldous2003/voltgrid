/**
 * components/statusIndicator.js
 * ─────────────────────────────────────────────────────────
 * Manages the top-of-dashboard ONLINE / OFFLINE banner and
 * nav indicator.  Call setSystemStatus() from dashboard.js.
 * ─────────────────────────────────────────────────────────
 */

const StatusIndicator = (() => {
  let _lastReceived  = null;    // timestamp ms of last data
  let _timerInterval = null;

  /**
   * Set system status.
   * @param {"online"|"offline"} status
   */
  function setStatus(status) {
    const banner     = document.getElementById("status-banner");
    const indicator  = document.getElementById("live-indicator");
    const sbTitle    = document.getElementById("sb-title");
    const navDot     = document.getElementById("nav-dot");
    const navText    = document.getElementById("nav-status-text");

    if (!banner) return;

    if (status === "online") {
      banner.classList.remove("offline");
      indicator && indicator.classList.remove("offline");
      if (sbTitle) { sbTitle.textContent = "SYSTEM ONLINE"; sbTitle.classList.remove("offline"); }
      if (navDot)  { navDot.className = "status-dot green"; }
      if (navText) { navText.textContent = "ONLINE"; }
    } else {
      banner.classList.add("offline");
      indicator && indicator.classList.add("offline");
      if (sbTitle) { sbTitle.textContent = "SYSTEM OFFLINE"; sbTitle.classList.add("offline"); }
      if (navDot)  { navDot.className = "status-dot red"; }
      if (navText) { navText.textContent = "OFFLINE"; }
    }
  }

  /**
   * Call this every time a data packet arrives.
   * Records timestamp and keeps the "last seen" counter fresh.
   */
  function markDataReceived() {
    _lastReceived = Date.now();
    setStatus("online");
    _updateLastSeen();

    // If no new data for 15s, flip to offline
    clearTimeout(StatusIndicator._offlineTimer);
    StatusIndicator._offlineTimer = setTimeout(() => {
      setStatus("offline");
    }, 15000);
  }

  function _updateLastSeen() {
    const el = document.getElementById("last-seen");
    if (!el || !_lastReceived) return;
    const diff = Math.floor((Date.now() - _lastReceived) / 1000);
    el.textContent = diff < 5
      ? "just now"
      : diff < 60
        ? `${diff}s ago`
        : `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
  }

  // Start a ticker to keep "last seen" label updated
  function startTicker() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(_updateLastSeen, 1000);
  }

  return {
    setStatus,
    markDataReceived,
    startTicker,
    _offlineTimer: null
  };
})();
