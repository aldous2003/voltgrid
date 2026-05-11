/**
 * js/auth.js
 * ─────────────────────────────────────────────────────────
 * Client-side authentication for VoltGrid.
 *
 * Features:
 *   - SHA-256 hashed passwords (Web Crypto API)
 *   - Persistent user data in localStorage (survives refresh)
 *   - Session management via sessionStorage (clears on tab close)
 *   - Admin can change room PINs
 *   - Extensible room management (future upgrade)
 *
 * Default accounts:
 *   admin  / admin123   → Admin (all rooms)
 *   room1  / room1pass  → User  (Room 1 only)
 *   room2  / room2pass  → User  (Room 2 only)
 * ─────────────────────────────────────────────────────────
 */

const VoltAuth = (() => {
  const SESSION_KEY = "voltgrid_session";
  const USERS_KEY   = "voltgrid_users";
  const ROOMS_KEY   = "voltgrid_rooms";

  // ── Default user definitions (unhashed — used only for first-time init) ──
  const DEFAULT_USERS = [
    { username: "admin", defaultPassword: "admin123", role: "admin", room: null,  displayName: "Administrator" },
    { username: "room1", defaultPassword: "room1pass", role: "user",  room: 1,    displayName: "Room 1 Tenant" },
    { username: "room2", defaultPassword: "room2pass", role: "user",  room: 2,    displayName: "Room 2 Tenant" }
  ];

  // ── SHA-256 Hashing ────────────────────────────────────
  /**
   * Hash a string using SHA-256 via Web Crypto API.
   * @param {string} str
   * @returns {Promise<string>} hex digest
   */
  async function hashPassword(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // ── User Storage ───────────────────────────────────────
  /**
   * Initialize user database in localStorage on first run.
   * Hashes all default passwords and stores them.
   */
  async function initUsers() {
    const existing = localStorage.getItem(USERS_KEY);
    if (existing) return; // already initialized

    const users = [];
    for (const def of DEFAULT_USERS) {
      users.push({
        username:    def.username,
        passwordHash: await hashPassword(def.defaultPassword),
        pin:         def.defaultPassword,
        role:        def.role,
        room:        def.room,
        displayName: def.displayName
      });
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    // Also initialize default rooms
    initRooms();
    console.info("[VoltGrid Auth] User database initialized.");
  }

  /**
   * Get all stored users.
   * @returns {Array}
   */
  function getStoredUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save users array to localStorage.
   * @param {Array} users
   */
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  // ── Login ──────────────────────────────────────────────
  /**
   * Attempt to log in with the given credentials.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ success: boolean, error?: string, user?: Object }>}
   */
  async function login(username, password) {
    const trimUser = (username || "").trim().toLowerCase();
    const trimPass = (password || "").trim();

    if (!trimUser || !trimPass) {
      return { success: false, error: "Please enter both username and password." };
    }

    const users = getStoredUsers();
    const inputHash = await hashPassword(trimPass);

    const user = users.find(
      u => u.username === trimUser && u.passwordHash === inputHash
    );

    if (!user) {
      return { success: false, error: "Invalid username or password." };
    }

    // Store session
    const session = {
      username:    user.username,
      role:        user.role,
      room:        user.room,
      displayName: user.displayName,
      loginTime:   Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return { success: true, user: session };
  }

  // ── Logout ─────────────────────────────────────────────
  /**
   * Log out the current user and redirect to login page.
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  // ── Session ────────────────────────────────────────────
  /**
   * Get the current session, or null if not logged in.
   * @returns {Object|null}
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a user is currently logged in.
   * @returns {boolean}
   */
  function isLoggedIn() {
    return getSession() !== null;
  }

  // ── Route Guards ───────────────────────────────────────
  /**
   * Route guard — require authentication and optionally a specific role.
   * Redirects to login page if unauthorized.
   * @param {string[]} [allowedRoles]
   * @returns {Object|null}
   */
  function requireAuth(allowedRoles) {
    const session = getSession();

    if (!session) {
      window.location.href = "index.html";
      return null;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(session.role)) {
        if (session.role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "user.html";
        }
        return null;
      }
    }

    return session;
  }

  /**
   * Redirect already-logged-in users away from the login page.
   */
  function redirectIfLoggedIn() {
    const session = getSession();
    if (!session) return;

    if (session.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "user.html";
    }
  }

  // ── Admin: Room User Management ────────────────────────
  /**
   * Get all room users (non-admin accounts).
   * @returns {Array<{ username, room, displayName }>}
   */
  function getRoomUsers() {
    const users = getStoredUsers();
    return users
      .filter(u => u.role === "user")
      .map(u => ({
        username:    u.username,
        room:        u.room,
        username:    u.username,
        room:        u.room,
        displayName: u.displayName,
        pin:         u.pin
      }));
  }

  /**
   * Change the PIN/password for a room user.
   * @param {number} roomId  - room number (1, 2, ...)
   * @param {string} newPin  - new password
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async function changeRoomPin(roomId, newPin) {
    const pin = (newPin || "").trim();

    if (!pin) {
      return { success: false, error: "PIN cannot be empty." };
    }
    if (pin.length < 4) {
      return { success: false, error: "PIN must be at least 4 characters." };
    }

    const users = getStoredUsers();
    const userIndex = users.findIndex(u => u.role === "user" && u.room === roomId);

    if (userIndex === -1) {
      return { success: false, error: `Room ${roomId} user not found.` };
    }

    users[userIndex].passwordHash = await hashPassword(pin);
    users[userIndex].pin = pin;
    saveUsers(users);

    return { success: true };
  }

  /**
   * Change the admin password.
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async function changeAdminPassword(currentPassword, newPassword) {
    const current = (currentPassword || "").trim();
    const newPass = (newPassword || "").trim();

    if (!current || !newPass) {
      return { success: false, error: "Both current and new password are required." };
    }
    if (newPass.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }

    const users = getStoredUsers();
    const adminIndex = users.findIndex(u => u.role === "admin");

    if (adminIndex === -1) {
      return { success: false, error: "Admin account not found." };
    }

    const currentHash = await hashPassword(current);
    if (users[adminIndex].passwordHash !== currentHash) {
      return { success: false, error: "Current password is incorrect." };
    }

    users[adminIndex].passwordHash = await hashPassword(newPass);
    saveUsers(users);

    return { success: true };
  }

  /**
   * Add a new room user.
   * @param {number} roomId
   * @param {string} username
   * @param {string} pin
   * @param {string} displayName
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async function addRoomUser(roomId, username, pin, displayName) {
    const users = getStoredUsers();

    // Check if room already exists
    if (users.find(u => u.room === roomId)) {
      return { success: false, error: `Room ${roomId} already has a user.` };
    }
    // Check if username taken
    if (users.find(u => u.username === username.toLowerCase())) {
      return { success: false, error: `Username "${username}" is already taken.` };
    }

    users.push({
      username:    username.toLowerCase(),
      passwordHash: await hashPassword(pin),
      pin:         pin,
      role:        "user",
      room:        roomId,
      displayName: displayName || `Room ${roomId} Tenant`
    });

    saveUsers(users);
    // Also add room config
    addRoomConfig(roomId, `Room ${roomId}`);
    return { success: true };
  }

  // ── Room Configuration Management ──────────────────────
  /**
   * Initialize default room configs in localStorage.
   */
  function initRooms() {
    const existing = localStorage.getItem(ROOMS_KEY);
    if (existing) return;
    const defaultRooms = [
      { id: 1, name: "Room 1", credit: 73.20, remainingKwh: 6.80, relay: true, power: 1067.0, totalEnergy: 12.44 },
      { id: 2, name: "Room 2", credit: 18.50, remainingKwh: 1.72, relay: true, power: 0,      totalEnergy: 8.91  }
    ];
    localStorage.setItem(ROOMS_KEY, JSON.stringify(defaultRooms));
  }

  /**
   * Get all room configs.
   * @returns {Array}
   */
  function getRoomConfigs() {
    initRooms(); // ensure initialized
    try {
      const raw = localStorage.getItem(ROOMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Add a new room config.
   * @param {number} roomId
   * @param {string} name
   */
  function addRoomConfig(roomId, name) {
    const rooms = getRoomConfigs();
    if (rooms.find(r => r.id === roomId)) return; // already exists
    rooms.push({
      id: roomId,
      name: name || `Room ${roomId}`,
      credit: +(15 + Math.random() * 60).toFixed(2),
      remainingKwh: +(1 + Math.random() * 6).toFixed(2),
      relay: true,
      power: 0,
      totalEnergy: +(5 + Math.random() * 10).toFixed(2)
    });
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  }

  /**
   * Update an existing room config.
   * @param {number} roomId
   * @param {Object} updates
   */
  function updateRoomConfig(roomId, updates) {
    const rooms = getRoomConfigs();
    const index = rooms.findIndex(r => r.id === roomId);
    if (index !== -1) {
      rooms[index] = { ...rooms[index], ...updates };
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    }
  }

  /**
   * Get the next available room ID.
   * @returns {number}
   */
  function getNextRoomId() {
    const rooms = getRoomConfigs();
    if (rooms.length === 0) return 1;
    return Math.max(...rooms.map(r => r.id)) + 1;
  }

  /**
   * Convenience: add a new room with auto-generated ID, username, and default PIN.
   * @returns {Promise<{ success: boolean, roomId?: number, error?: string }>}
   */
  async function addRoom() {
    const roomId = getNextRoomId();
    const username = `room${roomId}`;
    const defaultPin = `room${roomId}pass`;
    const displayName = `Room ${roomId} Tenant`;

    const result = await addRoomUser(roomId, username, defaultPin, displayName);
    if (result.success) {
      return { success: true, roomId };
    }
    return result;
  }

  /**
   * Delete a room and its user.
   * @param {number} roomId
   */
  function deleteRoom(roomId) {
    const users = getStoredUsers();
    const updatedUsers = users.filter(u => !(u.role === "user" && u.room === roomId));
    saveUsers(updatedUsers);

    const rooms = getRoomConfigs();
    const updatedRooms = rooms.filter(r => r.id !== roomId);
    localStorage.setItem(ROOMS_KEY, JSON.stringify(updatedRooms));
    return { success: true };
  }

  /**
   * Reset all users and rooms to defaults (for troubleshooting).
   */
  function resetToDefaults() {
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(ROOMS_KEY);
  }

  return {
    initUsers,
    login,
    logout,
    getSession,
    isLoggedIn,
    requireAuth,
    redirectIfLoggedIn,
    getRoomUsers,
    getRoomConfigs,
    updateRoomConfig,
    getNextRoomId,
    addRoom,
    deleteRoom,
    changeRoomPin,
    changeAdminPassword,
    addRoomUser,
    resetToDefaults
  };
})();
