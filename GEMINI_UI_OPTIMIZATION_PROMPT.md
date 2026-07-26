# 🚀 الموجه الهندسي الفائق لـ Gemini (Master Prompt for Gemini UI/UX Re-Architecting)

> **التعليمات:** انسخ هذا الموجه (Prompt) بالكامل والصقه في **Gemini** مرفقاً معه الملفات النصية المجمعة (`all_student_portal_components.txt`, `dev_portal_all_components.txt`, `admin_lecturer_public_portals_all_components.txt`).

---

```markdown
# ROLE & IDENTITY
You are a World-Class Principal UI/UX Architect and Senior React Systems Engineer working on "Al-Manar University System" — a state-of-the-art Mobile-First ERP & Academic Schedule Management Platform.

# MISSION
You have been provided with the complete existing source code files for the application frontend. Your task is to perform an elite UI/UX overhaul, deep code modularization, and aesthetic redesign to match 2026 top-tier digital product standards (Apple iOS 18 Glassmorphism, Vercel Clean Design System, Cyber Neon Dark Aesthetics).

# CORE OBJECTIVES
1. **Eliminate Cognitive Overload & Clutter**: De-clutter congested views. Break down multi-thousand line orchestrators into elegant, focused, micro-components.
2. **Global Benchmark Research**: Search and integrate design patterns inspired by top-tier apps (Linear.app, Raycast, Cron/Notion Calendar, Duolingo Gamification, Telegram Web).
3. **Elevate Aesthetics to Ultra-Premium**:
   - Palette: Midnight Pure Black (#070b13) with Neon Amber/Emerald accents and subtle glassmorphism backdrop blurs (`backdrop-blur-xl`).
   - Typography: Cairo / Urbanist / Inter hierarchy with WCAG AA high-contrast rules.
   - Micro-Interactions: Haptic feedback triggers, smooth Framer Motion spring physics, and subtle glowing hover states.
4. **Mobile-Native UX**: Ensure 100% responsiveness on mobile devices (touch gestures, pull-to-refresh, bottom navigation docks, safe-area-insets).
5. **Modular Architecture**: Separate state logic, UI presentation cards, modal overlays, and API callers cleanly.

# INPUT SOURCE CODES & SYSTEM DOMAIN
The application covers:
- **Student Portal**: Home tab (countdown timer, streak XP, warnings), Timetable Schedule (daily/weekly timeline, break intervals), Exchange Hub (live group chat, AI thread summarizer, interactive polls, verified answers), Digital Student ID & Attendance Analytics, Pomodoro Focus Mode & Smart Task Split.
- **Cohort Delegate Hub**: Live QR generator/scanner, student roster status toggles (Present/Absent/Late/Excused), class broadcast alerts, reschedule request manager.
- **Faculty & Lecturer Portal**: Live attendance scanner, lecture cancel/override requests, CSV roster exports.
- **Master Admin & Dev Portal**: Live system telemetry, multi-tenant context selector, God impersonator, SQL query terminal, AI self-healing patcher.

# INSTRUCTIONS FOR GEMINI
1. **Analyze Provided Source Code**: Read all attached codebase files carefully. Identify all redundant components, inline styling smells, state flash issues, and UI clutter.
2. **Formulate Redesign Blueprint**:
   - Proposed layout changes for Home, Schedule, Forum, Profile, Delegate, and Dev views.
   - Component breakdown structure (creating modular subcomponents).
3. **Provide Full Rewritten Code**: Write complete, clean, drop-in replacement React (JSX) & CSS code blocks. DO NOT use placeholder comments like `// rest of code here`. Output complete functional code.
4. **Design Tokens & System Rules**: Use CSS variables for theme modes (Dark/Light/Purple/Blue/Amber) and Tailwind utility classes for layout composition.

---
NOW PROCEED TO ANALYZE THE ATTACHED FILE SOURCES AND GENERATE THE COMPLETE RE-ARCHITECTED CODE IMPLEMENTATION.
```
