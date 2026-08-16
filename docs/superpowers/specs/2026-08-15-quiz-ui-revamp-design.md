# Quiz App UI/UX Revamp — Design

**Date:** 2026-08-15
**Status:** Approved (design), pending spec review

## Goal

Modernize the quiz application's UI/UX with a clean, professional layout and add three capabilities:

1. A shared page header showing the logged-in user's name, with a logout option.
2. A profile feature to update the display name and change the password.
3. A per-question "See Answer" button that reveals the correct answer(s) and explanation inline.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Visual direction | Clean & professional, **teal** accent (`#0d9488`) |
| "See Answer" scoring impact | **None** — pure study aid; question still scores normally on submit |
| Profile editable fields | **Name + password** (username is immutable) |
| Revamp scope | **All pages** — quiz, login/register, admin |
| Profile UI | **Modal** opened from the avatar menu (no new page/route) |
| Header injection | **Shared `header.js`** injected into a placeholder on authed pages |

## Architecture

Static HTML pages served by Express; no build step or templating. Backend is Express + SQLite with JWT auth. The revamp keeps this stack and adds no runtime dependencies.

### Backend changes

**New `middleware/auth.js`** — extract the currently-duplicated auth logic into one module exporting:
- `auth(req, res, next)` — verifies `Authorization: Bearer <token>`, sets `req.user = decoded.username`. (Currently duplicated inline in `routes/questions.js`.)
- `adminOnly(req, res, next)` — same, plus requires `decoded.username === "admin"`. (Currently inline in `routes/admin.js`.)

`routes/questions.js` and `routes/admin.js` are updated to import from this module instead of defining their own.

**New endpoints in `routes/auth.js`** (all behind `auth`):

- `GET /api/auth/me` → `{ username, name }`. Drives the header. Looked up from the `users` table by `req.user`.
- `PUT /api/auth/profile` → body `{ name }`. Updates `users.name` for the current user. Returns `{ message, name }`.
- `PUT /api/auth/password` → body `{ currentPassword, newPassword }`. Verifies `currentPassword` with `bcrypt.compareSync` against the stored hash; on mismatch returns `401`. On success hashes `newPassword` (bcrypt, cost 10) and updates. Returns `{ message }`. Rejects missing/empty fields with `400`.

No schema changes — `users.name` already exists; `db.sqlite` already seeded.

### Frontend changes

**Design system (`public/style.css`)** — reorganize around CSS custom properties defined on `:root`:
- Palette: teal accent (`#0d9488`), teal-light surface (`#ecfdf5`), neutral grays for text/borders, off-white app background.
- Scales for spacing, border-radius, and a subtle shadow.
- System font stack (`-apple-system, Segoe UI, Roboto, sans-serif`).
- All existing pages re-skinned against these tokens; existing class names reused where practical.

**Shared header + profile (`public/header.js`, new)** — a single script included on authed pages (`index.html`, `admin.html`). On load it:
1. Reads the token from `localStorage`; if absent, redirects to `/login.html`.
2. Calls `GET /api/auth/me`; on `401/403` clears token and redirects to login.
3. Injects a sticky top header into a `<div id="app-header"></div>` placeholder: brand/logo left; right side shows the timer slot (quiz page only), the user's name + avatar (initials), and a dropdown menu → **Profile**, **Admin panel** (only when username is `admin`), **Logout**.
4. Injects the **profile modal** markup (hidden by default) with two sections — *Edit profile* (name) and *Change password* (current + new) — each with an inline success/error message area.
5. Wires: Logout → clear token, redirect to login. Profile submit → `PUT /api/auth/profile`, update the name shown in the header on success. Password submit → `PUT /api/auth/password`, show inline result, clear fields on success.

The header exposes a hook so the quiz page can render the timer into the header's timer slot.

**Quiz page (`public/index.html`, `public/app.js`)**:
- Add `<div id="app-header"></div>` and include `header.js`.
- Move the timer display into the header's timer slot.
- Each question card gets a **See Answer** button that toggles an answer box showing the correct answer(s) (`q.answer`) and explanation (`q.explanation`, rendered with `\n` → `<br/>`). Toggle is per-question and has **no effect on scoring** — submit still scores every question. Reuses/​restyles the existing unused `.reveal-btn` / `.answer-box` classes.
- Remove the ad-hoc 401/403 check now handled centrally by `header.js` (quiz fetch keeps its own failure handling for non-auth errors).

**Login / register (`public/login.html`)** — re-skinned to the new design system. Tidy the toggle logic so the initial state is deterministic (show login first). No header (unauthenticated). Replace `alert()` with inline messages.

**Admin (`public/admin.html`)** — add the shared header (`app-header` + `header.js`), re-skin the upload card to the new system, replace bare status text with an inline message.

### Data flow

```
Authed page load
  → header.js reads token
  → GET /api/auth/me  ──(401/403)──▶ clear token → /login.html
  → render header (name, menu) + inject hidden profile modal

Profile modal (name)      → PUT /api/auth/profile  → update header name
Profile modal (password)  → PUT /api/auth/password → inline result
Logout                    → clear token → /login.html

Quiz "See Answer" (client-only)
  → toggle answer box using q.answer / q.explanation already in the
    GET /api/questions response; no request, no scoring change
```

### Error handling

- Replace `alert()` calls with inline messages / lightweight toasts for a modern feel.
- Auth endpoints return appropriate status codes: `400` (missing fields), `401` (bad current password / invalid token), and JSON `{ message }` bodies. Frontend surfaces `message` inline.

### Testing

No test framework exists today. Add lightweight API tests for the new auth endpoints using Node's built-in `node:test` + `node:assert` (zero new dependencies), covering:
- `GET /api/auth/me` returns the current user's name.
- `PUT /api/auth/profile` updates the name.
- `PUT /api/auth/password` rejects a wrong current password (`401`) and succeeds with the correct one.

Add an `npm test` script running `node --test`. Frontend changes verified manually by running the server. *(If preferred, we can skip the automated tests and stay manual-only — flag during spec review.)*

## Out of scope

- Changing the username, roles/permissions beyond the existing hardcoded `admin` check.
- Cleaning up `uploads/` accumulation, replacing the committed `jwtSecret`, or other pre-existing issues noted in CLAUDE.md.
- Score history / results pages beyond what exists.

## Affected files

- New: `middleware/auth.js`, `public/header.js`, `test/auth.test.js`
- Modified: `routes/auth.js`, `routes/questions.js`, `routes/admin.js`, `public/style.css`, `public/index.html`, `public/app.js`, `public/login.html`, `public/admin.html`, `package.json`
