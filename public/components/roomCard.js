/**
 * components/roomCard.js
 * ─────────────────────────────────────────────────────────
 * Generates and updates Room Status card HTML.
 * Reusable component — call createRoomCard() to build DOM,
 * then updateRoomCard() to push new live data into it.
 * ─────────────────────────────────────────────────────────
 */

/**
 * Create a room card DOM element.
 * @param {Object} room  - { id, name, credit, remainingKwh, relay, power, totalEnergy }
 * @returns {HTMLElement}
 */
function createRoomCard(room) {
  const card = document.createElement("div");
  card.className = "room-card";
  card.id = `room-card-${room.id}`;
  card.innerHTML = buildRoomCardHTML(room);
  return card;
}

/**
 * Update an existing room card with fresh data.
 * @param {Object} room  - same shape as createRoomCard()
 */
function updateRoomCard(room) {
  const card = document.getElementById(`room-card-${room.id}`);
  if (!card) return;
  card.innerHTML = buildRoomCardHTML(room);

  // Relay state class
  card.className = "room-card";
  if (room.credit < 20) card.classList.add("low-credit");
  else if (room.relay) card.classList.add("relay-on");
  else card.classList.add("relay-off");
}

/**
 * Build room card inner HTML string.
 * @param {Object} room
 * @returns {string}
 */
function buildRoomCardHTML(room) {
  const creditPct = Math.min(100, Math.max(0, (room.credit / 200) * 100));
  const barClass = creditPct > 50 ? "high" : creditPct > 20 ? "mid" : "low";
  const relayClass = room.relay ? "relay-on-badge" : "relay-off-badge";
  const relayText = room.relay ? "● RELAY ON" : "○ RELAY OFF";
  const creditWarn = room.credit < 20 ? " warn" : "";

  return `
    <div class="room-header">
      <span class="room-name">${room.name}</span>
      <span class="room-relay-badge ${relayClass}">${relayText}</span>
    </div>
    <div class="room-stats">
      <div class="room-stat-row">
        <span class="rsr-label">Credit Balance</span>
        <span class="rsr-val credit${creditWarn}">₱ ${Number(room.credit).toFixed(2)}</span>
      </div>
      <div class="credit-bar-wrap">
        <div class="credit-bar ${barClass}" style="width:${creditPct.toFixed(1)}%"></div>
      </div>
      <div class="room-stat-row">
        <span class="rsr-label">Remaining kWh</span>
        <span class="rsr-val">${Number(room.remainingKwh).toFixed(3)} kWh</span>
      </div>
      <div class="room-stat-row">
        <span class="rsr-label">Line Voltage</span>
        <span class="rsr-val">${room.voltage ? Number(room.voltage).toFixed(1) + " V" : "220.0 V"}</span>
      </div>
      <div class="room-stat-row">
        <span class="rsr-label">Current Power</span>
        <span class="rsr-val">${room.relay ? Number(room.power).toFixed(1) + " W" : "— W"}</span>
      </div>
      <div class="room-stat-row">
        <span class="rsr-label">Total Energy Used</span>
        <span class="rsr-val">${Number(room.totalEnergy).toFixed(3)} kWh</span>
      </div>
    </div>
    ${IS_ADMIN ? `
    <div class="room-admin-ctrl">
      <button class="ctrl-btn ${room.relay ? 'off' : 'on'}" onclick="handleSetRelay(${room.id}, ${!room.relay})">
        ${room.relay ? '🔌 FORCE OFF' : '⚡ FORCE ON'}
      </button>
    </div>
    ` : ''}
  `;
}
