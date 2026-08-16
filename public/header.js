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
        <section class="profile-section">
          <button class="btn btn-secondary btn-block" id="openScores">My Scores</button>
        </section>
      </div>`;
    document.body.appendChild(overlay);
    injectScoresModal();
  }

  function injectScoresModal() {
    if (document.getElementById("scoresModal")) return;
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "scoresModal";
    overlay.innerHTML = `
      <div class="modal-box scores-modal">
        <div class="modal-header">
          <h2 id="scoresTitle">My Scores</h2>
          <span class="modal-close" id="scoresClose">&times;</span>
        </div>
        <div id="scoresBody" class="card"></div>
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

    document.getElementById("openScores").addEventListener("click", openScores);
    const scoresModal = document.getElementById("scoresModal");
    document
      .getElementById("scoresClose")
      .addEventListener("click", () => (scoresModal.style.display = "none"));
    scoresModal.addEventListener("click", (e) => {
      if (e.target === scoresModal) scoresModal.style.display = "none";
    });
  }

  async function openScores() {
    document.getElementById("profileModal").style.display = "none";
    const admin = currentUser.username === "admin";
    document.getElementById("scoresTitle").textContent = admin
      ? "All Scores"
      : "My Scores";
    const body = document.getElementById("scoresBody");
    body.innerHTML = "<p class='hint'>Loading…</p>";
    document.getElementById("scoresModal").style.display = "flex";

    try {
      const res = await fetch("/api/questions/scores", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        body.innerHTML = "<p class='form-msg error'>Failed to load scores.</p>";
        return;
      }
      renderScores(await res.json(), admin);
    } catch (e) {
      body.innerHTML = "<p class='form-msg error'>Failed to load scores.</p>";
    }
  }

  function renderScores(rows, admin) {
    const body = document.getElementById("scoresBody");
    if (!rows.length) {
      body.innerHTML = "<p class='hint'>No attempts yet.</p>";
      return;
    }
    const head = `
      <div class="scores-row scores-head">
        <span class="scores-date">Date</span>
        ${admin ? '<span class="scores-user">User</span>' : ""}
        <span class="scores-score">Score</span>
        <span class="scores-pct">%</span>
      </div>`;
    const list = rows
      .map((r) => {
        const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
        return `
      <div class="scores-row">
        <span class="scores-date">${escapeHtml(formatDate(r.takenAt))}</span>
        ${admin ? `<span class="scores-user">${escapeHtml(r.username)}</span>` : ""}
        <span class="scores-score">${escapeHtml(r.score)} / ${escapeHtml(r.total)}</span>
        <span class="scores-pct">${pct}%</span>
      </div>`;
      })
      .join("");
    body.innerHTML = `<div class="scores-table${admin ? " admin" : ""}">${
      head + list
    }</div>`;
  }

  function formatDate(s) {
    if (!s) return "";
    const d = new Date(String(s).replace(" ", "T") + "Z");
    return isNaN(d.getTime()) ? String(s) : d.toLocaleString();
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
