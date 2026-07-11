# 🎯 Standing Context & Setup - Al-Manar College Schedule System

This document contains the complete context, credentials, branch structure, and hosting configurations for the **standalone Al-Manar College Schedule System**. Share this file in new sessions to allow the AI coding assistant to quickly understand the project details.

---

## 📌 Project Overview
- **Project Name**: Al-Manar College Schedule System (بوابة الطالب الجامعي)
- **Branch**: `almanar-college-system`
- **Type**: 100% Standalone College Portal (no multi-tenant gateway or other universities)
- **Directory Structure**:
  - `backend/` - Node/Express backend with Prisma client.
  - `frontend/` - React/Vite/Vanilla CSS client.
  - `render.yaml` - Declarative Render.com deployment configuration.
  - `package.json` - Root package for script execution and workspaces.

---

## 🔒 Crucial Secrets & Credentials

### 1. Developer Portal Bypass Code
- **Bypass Code**: `708090`
- **Usage**: Used to bypass standard authentication on the Developer/Admin Secure Portal.

### 2. Default Seed Accounts
- **SUPER_ADMIN**:
  - **Email**: `m.gh.alosimi@gmail.com`
  - **Password**: `708090`
- **College Admin (Al-Manar)**:
  - **Email**: `admin.manar@manar.edu`
  - **Password**: `12345678`
- **Test Students (1 to 5)**:
  - **Emails**: `test1@almanar.edu.ye` up to `test5@almanar.edu.ye`
  - **Password**: `12345678`
  - **IDs**: `2026-TEST01` to `2026-TEST05`
  - **Phone Numbers**: `+967779000001` to `+967779000005`

---

## 🗄️ Database & Seeding Details

### 1. PostgreSQL Connection Settings
- Render PostgreSQL databases require SSL validation to be bypassed for self-signed certificates.
- The configuration in `backend/src/db.js` uses `ssl: { rejectUnauthorized: false }` unconditionally.
- Recommend appending `?sslmode=require&sslaccept=accept_invalid_certs&connection_limit=3` to `DATABASE_URL`.
- Setting `connection_limit=3` (or lower) prevents connection exhaustion on the Render database free tier.

### 2. Automated Seeding
- On deployment, Render runs `node backend/prisma/seed.js`.
- The seed script has a safety check to **prevent wiping existing user data** if the database already contains majors:
  ```javascript
  const majorCount = await prisma.major.count().catch(() => 0);
  if (majorCount > 0) return; // Database already seeded, skips safely
  ```
- If the database has 0 majors (first build or clean db), it resets all tables and inserts:
  - Al-Manar University & College (slugs: `almanar-college`, `almanar-main`).
  - 3 Departments (Engineering & IT, Administrative & Financial, Sharia & Health).
  - 6 Majors (IT, Cyber Security, Business, Accounting, Sharia/Law, Health Admin).
  - 5 Rooms (`قاعة (3)`, `قاعة (5)`, `قاعة (6)`, `قاعة (7)`, `قاعة (8)`).
  - 28 Lecturers, all levels, groups, subjects, schedules, and 1,000 realistic dummy students.

---

## 🚀 How to Run Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env` file inside the `backend/` directory:
   ```env
   DATABASE_URL="postgresql://username:password@host:5432/db_name?sslmode=require&sslaccept=accept_invalid_certs&connection_limit=3"
   JWT_SECRET="generate-any-long-secure-key"
   PORT=5001
   ```
3. **Start Development Servers**:
   ```bash
   npm run dev
   ```
   This will run both backend (port 5001) and frontend (port 5173) concurrently.

---

## ☁️ How to Deploy Standalone on Render

1. Create a Web Service connected to the GitHub repository.
2. In the Settings tab, select the **Branch** `almanar-college-system`.
3. Render will auto-detect the configuration using [render.yaml](file:///f:/almanar-college-system/render.yaml):
   - **Build Command**: `npm install --include=dev && node backend/prisma/seed.js && npm run build:frontend`
   - **Start Command**: `node backend/src/server.js`
4. Set the environment variables `DATABASE_URL` and `JWT_SECRET` in the Render service dashboard.
5. Trigger manual deploy with clear cache. The database will automatically seed on the first build!
