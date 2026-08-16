(function () {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  let currentUser = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name, username) {
    const base = (name && name.trim()) || username || "?";
    const parts = base.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function render() {
    const mount = document.getElementById("app-header");
    if (!mount) return;
    const admin = currentUser.username === "admin";
    mount.innerHTML = `
      <header class="app-header">
        <div class="brand"><span class="brand-logo">Q</span><span class="brand-name">Quiz App</span></div>
        <div class="header-right">
          <div class="header-timer" id="headerTimer"></div>
          <div class="user-menu">
            <button class="user-menu-btn" id="userMenuBtn">
              <span class="avatar">${escapeHtml(initials(currentUser.name, currentUser.username))}</span>
              <span class="user-name">${escapeHtml(currentUser.name || currentUser.username)}</span>
              <span class="caret">&#9662;</span>
            </button>
            <div class="user-dropdown" id="userDropdown" hidden>
              <button class="dropdown-item" id="openProfile">Profile</button>
              ${admin ? '<a class="dropdown-item" href="/admin.html">Admin panel</a>' : ""}
              <button class="dropdown-item danger" id="logoutBtn">Logout</button>
            </div>
          </div>
        </div>
      </header>`;
    injectModal();
    wire();
  }

  function injectModal() {
    if (document.getElementById("profileModal")) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "profileModal";
    overlay.innerHTML = `
      <div class="modal-box profile-modal">
        <div class="modal-header">
          <h2>My Profile</h2>
          <span class="modal-close" id="profileClose">&times;</span>
        </div>
        <section class="profile-section">
          <h3>Profile</h3>
          <label class="field-label">Name</label>
          <input class="txt-input" id="profileName" placeholder="Your name">
          <label class="field-label">Username</label>
          <input class="txt-input" id="profileUsername" disabled>
          <button class="btn btn-primary" id="saveProfile">Save profile</button>
          <p class="form-msg" id="profileMsg"></p>
        </section>
        <section class="profile-section">
          <h3>Change password</h3>
          <label class="field-label">Current password</label>
          <input class="txt-input" type="password" id="currentPassword">
          <label class="field-label">New password</label>
          <input class="txt-input" type="password" id="newPassword">
          <button class="btn btn-primary" id="savePassword">Update password</button>
          <p class="form-msg" id="passwordMsg"></p>
        </section>
      </div>`;
    document.body.appendChild(overlay);
  }

  function wire() {
    const dropdown = document.getElementById("userDropdown");
    document.getElementById("userMenuBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });
    document.addEventListener("click", () => (dropdown.hidden = true));

    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    });

    const modal = document.getElementById("profileModal");
    document.getElementById("openProfile").addEventListener("click", () => {
      document.getElementById("profileName").value = currentUser.name || "";
      document.getElementById("profileUsername").value = currentUser.username;
      document.getElementById("profileMsg").textContent = "";
      document.getElementById("passwordMsg").textContent = "";
      modal.style.display = "flex";
    });
    document
      .getElementById("profileClose")
      .addEventListener("click", () => (modal.style.display = "none"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    document.getElementById("saveProfile").addEventListener("click", saveProfile);
    document
      .getElementById("savePassword")
      .addEventListener("click", savePassword);
  }

  async function saveProfile() {
    const name = document.getElementById("profileName").value.trim();
    const msg = document.getElementById("profileMsg");
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.className = "form-msg " + (res.ok ? "ok" : "error");
    if (res.ok) {
      currentUser.name = data.name;
      document.querySelector(".user-name").textContent =
        data.name || currentUser.username;
      document.querySelector(".avatar").textContent = initials(
        currentUser.name,
        currentUser.username
      );
    }
  }

  async function savePassword() {
    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const msg = document.getElementById("passwordMsg");
    const res = await fetch("/api/auth/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    msg.textContent = data.message;
    msg.className = "form-msg " + (res.ok ? "ok" : "error");
    if (res.ok) {
      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value = "";
    }
  }

  async function loadUser() {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
      return;
    }
    currentUser = await res.json();
    render();
  }

  loadUser();
})();
