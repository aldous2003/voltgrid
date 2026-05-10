/**
 * js/auth.js
 * ─────────────────────────────────────────────────────────
 * Client-side authentication for VoltGrid.
 *
 * Demo accounts (hardcoded for engineering project):
 *   admin  / admin123   → Admin (all rooms)
 *   room1  / room1pass  → User  (Room 1 only)
 *   room2  / room2pass  → User  (Room 2 only)
 *
 * Session is stored in sessionStorage and cleared on
 * browser tab close or explicit logout.
 * ─────────────────────────────────────────────────────────
 */

const VoltAuth = (() => {
  // ── Hardcoded user accounts ──────────────────────────
  const USERS = [
    { username: "admin", password: "admin123", role: "admin", room: null,  displayName: "Administrator" },
    { username: "room1", password: "room1pass", role: "user",  room: 1,    displayName: "Room 1 Tenant" },
    { username: "room2", password: "room2pass", role: "user",  room: 2,    displayName: "Room 2 Tenant" }
  ];

  const SESSION_KEY = "voltgrid_session";

  /**
   * Attempt to log in with the given credentials.
   * @param {string} username
   * @param {string} password
   * @returns {{ success: boolean, error?: string, user?: Object }}
   */
  function login(username, password) {
    const trimUser = (username || "").trim().toLowerCase();
    const trimPass = (password || "").trim();

    if (!trimUser || !trimPass) {
      return { success: false, error: "Please enter both username and password." };
    }

    const user = USERS.find(
      u => u.username === trimUser && u.password === trimPass
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

  /**
   * Log out the current user and redirect to login page.
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "index.html";
  }

  /**
   * Get the current session, or null if not logged in.
   * @returns {Object|null}  { username, role, room, displayName, loginTime }
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

  /**
   * Route guard — require authentication and optionally a specific role.
   * Redirects to login page if unauthorized.
   * @param {string[]} [allowedRoles]  - e.g. ["admin"] or ["admin","user"]
   * @returns {Object|null}  session if authorized, null otherwise (and redirects)
   */
  function requireAuth(allowedRoles) {
    const session = getSession();

    if (!session) {
      window.location.href = "index.html";
      return null;
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (!allowedRoles.includes(session.role)) {
        // User is logged in but wrong role — redirect to their correct dashboard
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
   * Call this on index.html to skip login if session exists.
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

  return {
    login,
    logout,
    getSession,
    isLoggedIn,
    requireAuth,
    redirectIfLoggedIn
  };
})();
