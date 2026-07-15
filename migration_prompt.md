# 🚀 Prompt for Migrating Updates from the Big Project to Standalone Al-Manar College System

This prompt is designed to be given to an AI assistant (like Antigravity or Gemini) along with the modified/new files or snippets from the **Big Project** (the multi-tenant system) to merge them into the **Standalone Al-Manar College System**.

---

### How to Use This Prompt:
1. **Copy the prompt content below** (everything from the horizontal line down).
2. **Paste it in a new chat** or in the current chat.
3. **Attach or paste the contents of the files from the Big Project** (e.g., the updated `DevPortal.jsx`, `admin.js`, or other modified views/routes).
4. Let the AI execute the merge into the standalone files.

---

```markdown
# Context: Standalone Al-Manar College System Migration Instruction

We are migrating advanced features, layout updates, and bug fixes from a larger multi-tenant parent project ("the Big Project") into this standalone repository: **Al-Manar College Schedule System (بوابة الطالب الجامعي)**.

## 🎯 The Target System (Al-Manar College System)
- **Branch**: `almanar-college-system`
- **Architecture**:
  - `backend/` (Node.js/Express, Prisma PostgreSQL)
  - `frontend/` (React, Vite, Vanilla CSS with custom theme styling)
- **Type**: 100% Standalone (single-college). All multi-tenant routing, tenant selection, university switching, or governorate management code is stripped or disabled in this repository.
- **Developer Portal Bypass Code**: `708090` (Allows bypassing standard authentication to access administrative developer functions).
- **Core Files**:
  - Frontend Views:
    - [DevPortal.jsx](file:///frontend/src/DevPortal.jsx) (Developer control dashboard)
    - [AdminDashboard.jsx](file:///frontend/src/AdminDashboard.jsx) / [AdminOverview.jsx](file:///frontend/src/AdminOverview.jsx) (College administration dashboard)
    - [App.jsx](file:///frontend/src/App.jsx) (Main layout & routing)
    - [Login.jsx](file:///frontend/src/Login.jsx) / [Register.jsx](file:///frontend/src/Register.jsx) / [Verification.jsx](file:///frontend/src/Verification.jsx) (User authentication)
  - Backend Routes:
    - [admin.js](file:///backend/src/routes/admin.js)
    - [auth.js](file:///backend/src/routes/auth.js)
    - [student.js](file:///backend/src/routes/student.js)

---

## 🛠️ Instructions for Merging Changes

When I provide code snippets or files from the Big Project, you must follow these rules to merge them into this standalone repository:

### 1. Identify File Mappings
Map the incoming Big Project files to the standalone workspace equivalents:
- Big Project `universities/almanar-college/frontend/...` or shared frontend components ➡️ Standalone `frontend/src/...`
- Big Project `universities/almanar-college/backend/...` or backend routes ➡️ Standalone `backend/src/...`

### 2. Remove Multi-Tenancy Code (Enforce Standalone Mode)
The Big Project supports multiple universities and tenants. In this standalone project, everything is Al-Manar College.
- **DO NOT** import or use governorate management, university provisioning, tenant lists (`/api/tenants`), or tenant subdomains.
- If a route in the Big Project code has university filtering (e.g., `where: { universityId }` or checks for `tenant_id`), simplify or adapt it to target the static Al-Manar tenant/college or remove the restriction entirely if it's implicitly single-tenant.
- Maintain the standalone bypass authentication code (`708090`) on the Developer Portal and Super Admin accounts.

### 3. Prevent Code Duplication & Preserve Standalone Configurations
- Do not add duplicate endpoints, functions, or import paths.
- Check the current standalone file first to see what custom fixes are already implemented (e.g., SSL validation bypass, database seeding safety checks, custom CSS classes, custom PWA hooks like `usePWAInstall.js`).
- Preserve any unique layout settings, localized branding (Al-Manar University/College logo with shimmers, neon lime theme variables), and direct paths.

### 4. Code Formatting & Aesthetics
- All frontend updates must align with the premium, responsive, mobile-first design language in `frontend/src/index.css` (using glassmorphic effects, modern typography, grid layouts, and custom animations).
- Maintain clean, self-documenting code with inline comments in Arabic/English where appropriate, keeping the existing comments unless directly replaced by new logic.
- Verify that changes do not break Prisma schemas or introduce syntax errors in React JSX.

---

## 📝 Input Files to Process
[USER: Insert/Paste the file content or diffs from the Big Project below, specifying the target path you want to update]
```
