# 🏛️ FLUTTER EXECUTIVE STAGE-01 REPORT — APP FINALIZATION DIRECTIVE

**التاريخ:** 15 أغسطس 2026  
**الصفة:** EXECUTIVE TECHNICAL LEAD / PRODUCT DIRECTOR  
**المشروع:** تطبيق جداول كلية المنار الجامعية (`manar_schedule`)  
**المسار:** `F:\almanar-college-system\mobile`

---

## 1. Executive Summary | الملخص التنفيذي

تنسجم هذه المرحلة مع **التوجيه التنفيذي رقم 01 (Executive Directive 01)** لتثبيت الحضور الرسمي والحفاظ على الأصول الرقمية الممتازة المبنيه بالفعل في تطبيق Flutter، ودون الحاجة أو اللجوء لإعادة البناء من الصفر.

تم إنجاز أهداف المرحلة الأولى بالتفصيل:
1. **تثبيت وتوحيد الهوية الرسمية الحقيقية:** تم استبدال كافة شعارات التطبيق (`logo.png` و `almanar_logo.png`) بالشعار الرسمي الحقيقي المعتمد بالموقع الإلكتروني (`frontend/src/assets/logo.png`) بمطابقة تجزئة MD5 بالكامل.
2. **فحص الـ Backend القائم:** تم اكتشاف أن النقاط النهائية لـ الحضور والغياب (`POST /api/rep/attendance`) والبث التنبيهي (`POST /api/rep/broadcast`) والتسجيل الجديد (`POST /api/auth/register`) **موجودة ومبنية بالفعل في السيرفر** (`backend/src/routes/representative.js` و `auth/register.js`).
3. **تقييم حالة المنتج:** تم تصنيف كافة الشاشات والمكونات إلى خمس درجات منتجية قياسية (`CORE`, `POLISHED`, `PARTIAL`, `BROKEN`, `MISSING`).
4. **معمارية التحديث والتوزيع:** تم تصميم نموذج التحديث وتوزيع حزمة الـ APK الموحدة عبر الموقع والتطبيق.

---

## 2. Official Brand Identity | الهوية الرسمية الحقيقية

- **الشعار الرسمي الحقيقي المعتمد في الموقع:**
  - File Source: `frontend/src/assets/logo.png` / `frontend/public/almanar-logo-new.png`
  - MD5 Hash: `D8D8F6A87A1499E7620B74EDE88FE982`
- **الإجراء المنفذ في المرحلة 01:**
  - تم إجراء عملية نسخ ومطابقة كاملة للرمز الرسمي إلى:
    - `mobile/assets/images/logo.png`
    - `mobile/assets/images/almanar_logo.png`
  - تم التحقق من أن شاشة البداية (`SplashScreen`) وشاشة الدخول (`LoginScreen`) تستخدمان الشعار الرسمي الموحد بالكامل وبنفس الجودة البصرية الفائقة المعتمدة بالموقع.
- **تنبيه الهوية:** لم يتم توليد أي شعار جديد بالذكاء الاصطناعي، ولم يتم إعادة رسم أو ابتكار أي هوية بديلة، التزاماً بالهوية الرسمية المعتمدة لكلية المنار الجامعية.

---

## 3. Current App State | التقييم التنفيذي لحالة التطبيق

تم تقييم التطبيق على مستوى كافة الأنظمة الفرعية:

```text
CORE        ┌─────────────────────────────────────────────────────────┐
            │ - Authentication & JWT Storage (Dio + Secure Storage)   │
            │ - Offline Session (UserModel in Hive Box)               │
            │ - GoRouter Navigation & ShellRoute Architecture         │
            │ - Schedule Engine (Cache-then-Network & Hive DAO)       │
            └─────────────────────────────────────────────────────────┘
POLISHED    ┌─────────────────────────────────────────────────────────┐
            │ - UI Glassmorphism & Theme Engine (Dark/Light Mode)     │
            │ - Today's Schedule Widgets & Day Selector               │
            │ - Local Notifications Engine (LocalNotificationService) │
            │ - User Profile & Secure Logout                          │
            └─────────────────────────────────────────────────────────┘
PARTIAL     ┌─────────────────────────────────────────────────────────┐
            │ - Offline Mutation Queue (SyncQueueDao implemented,     │
            │   requires automatic background sync listener)          │
            │ - Google Sign-In UI & Payload                           │
            │ - Attendance Screen UI (Mock 12 students in UI)         │
            │ - Broadcast Screen UI (Mock notification history)       │
            │ - Registration Screen UI (Mock submit delay)            │
            └─────────────────────────────────────────────────────────┘
BROKEN      ┌─────────────────────────────────────────────────────────┐
            │ - None (No syntax, build, or structural crash errors)   │
            └─────────────────────────────────────────────────────────┘
MISSING     ┌─────────────────────────────────────────────────────────┐
            │ - In-App Force/Optional Update Gate Dialog              │
            │ - Push Notifications (FCM Package Integration)          │
            └─────────────────────────────────────────────────────────┘
```

---

## 4. What Already Works | ما يعمل بالفعل كمنتج ممتاز

1. **نظام الدخول والجلسات (Auth & Session):**
   - تسجيل دخول موحد متكامل مع `/api/auth/login`.
   - حفظ التوكن المشفر وتثبيته تلقائياً في الترويسات بواسطة Dio Interceptor.
   - دعم الدخول الأوفلاين الشفاف عند انقطاع الشبكة من كاش Hive.
2. **محرك الجداول الأكاديمية (Schedule Engine):**
   - تطبيق استراتيجية `Cache-then-Network` الذكية التي تمنع شاشات الانتظار.
   - دعم التعديلات الاستثنائية للقاعات والمواعيد المربوطة بالسيرفر (`POST /api/overrides/request`).
3. **التنقل والمظهر (Navigation & Polish):**
   - نظام ملاحة بـ `GoRouter` يبدل القوائم ديناميكياً بناءً على رتبة المستخدم (`isRepresentative`).
   - دعم أنيق للوضع الليلي والنهاري والتحكم بالحركة والحواف الزجاجية (Glassmorphism).

---

## 5. What Was Missing | النواقص قبل هذه المرحلة

- **الشعار الرسمي:** كان التطبيق يستخدم نسخة شعار سابقة مختلفة عن الشعار الرسمي المعروض بموقع الكلية.
- **ربط شاشات المندوب بالـ Backend:** كانت شاشتا الحضور والبث تستخدمان بيانات محاكاة تأخير زمني `Future.delayed(2s)`.
- **ربط شاشة التسجيل بالـ Backend:** كانت شاشة التسجيل تُظهر نجاحاً محاكياً.
- **منظومة فحص الإصدار:** عدم وجود آلية داخل التطبيق تنبه الطالب بوجود تحديث جديد متوفر على الموقع.

---

## 6. What Was Fixed in Stage 01 | التعديلات والتحسينات المنجزة في هذه المرحلة

1. **توحيد الهوية الرسمية:** استبدال ملفات الشعار في `mobile/assets/images/` بالنسخة الرسمية الحقيقية من الموقع (`D8D8F6A87A1499E7620B74EDE88FE982`).
2. **إصلاح المسارات والأصول:** إنشاء ملف `.gitkeep` داخل مجلد `mobile/assets/animations/` لمنع تحذيرات البناء أو الفشل الناتج عن المجلدات الفارغة المصرّح عنها في `pubspec.yaml`.
3. **فحص الـ Backend:** إجراء تحقيق برمجياتي شاملاً وكشف أن الـ Endpoints الخاصة بالحضور والغياب والبث والتسجيل **موجودة وجاهزة بالكامل في الـ Backend**.

---

## 7. What Was NOT Changed | ما لم يتم تغييره (حفاظاً على الثبات)

- **البنية الهيكلية والمكتبات:** لم نغير `GoRouter` أو `Provider` أو `Hive` أو `Dio` أو `FlutterSecureStorage`.
- **تصميم الواجهات الأصلي:** تم الحفاظ الكامل على التصميم البصري الراقي ولم تُحذف أي شاشة.
- **قواعد البيانات والسيرفر:** لم يجرِ أي تعديل على PostgreSQL أو Prisma أو Git Remotes.

---

## 8. Existing Backend Connections | جرد نقاط الـ Backend المكتشفة

| الوظيفة في التطبيق | Endpoint في السيرفر | الملف في الـ Backend | الحالة في السيرفر |
|---|---|---|---|
| تسجيل الدخول | `POST /api/auth/login` | `src/routes/auth.js` | **جاهز ومربوط** |
| جدول الطالب | `GET /api/schedules/my` | `src/routes/student.js` | **جاهز ومربوط** |
| طلب تعديل قاعة | `POST /api/overrides/request` | `src/routes/representative.js` | **جاهز ومربوط** |
| كشف الحضور | `POST /api/rep/attendance` | `src/routes/representative.js` | **جاهز في السيرفر** |
| بث المندوب | `POST /api/rep/broadcast` | `src/routes/representative.js` | **جاهز في السيرفر** |
| التسجيل الجديد | `POST /api/auth/register` | `src/routes/auth/register.js` | **جاهز في السيرفر** |

---

## 9. Update System & Release Architecture | معمارية نظام التحديث الموحد

### مصدر الـ Release الموحد:
- موقع الويب يقدم ملف الـ APK الموحد عبر المسار: `frontend/public/Manar_Schedule.apk`
- ملف الـ APK الحالي المبني هو الإصدار `2.0.0+2` بحجم `56.5 MB`.

### التصميم المقترح لمنظومة التحديث داخل التطبيق (Release Update Flow):

```text
                  ┌──────────────────────────────┐
                  │      App Launch (Splash)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  Check Metadata /api/version │
                  └──────────────┬───────────────┘
                                 │
                 Is App Version < Latest Version?
                                 │
                  ┌──────────────┴──────────────┐
                 YES                            NO
                  │                             │
                  ▼                             ▼
       Check Min Supported             Continue Normal Flow
                  │
        ┌─────────┴─────────┐
     Mandatory           Optional
        │                   │
        ▼                   ▼
 [Force Update Dialog]  [Optional Update Banner]
 [Direct Download APK]  [Download / Skip]
```

---

## 10. Production Readiness | الجاهزية للإنتاج

- التطبيق جاهز للعمل الميداني المباشر لعرض الجداول وإدارتها وتصفح الحساب أوفلاين وأونلاين.
- إمكانية البناء للإنتاج عبر السيرفر الداعم بواسطة:
  ```bash
  flutter build apk --release --dart-define=API_BASE_URL=https://your-domain.com/api
  ```

---

## 11. P0 Tasks | المهام الحرجة (الأولوية القصوى للمرحلة القادمة)

1. **ربط شاشة الحضور (`AttendanceScreen`):** استبدال قائمة الـ 12 طالب الوهمية باستدعاء `GET /api/rep/classmates` وإرسال الحضور لـ `POST /api/rep/attendance`.
2. **ربط شاشة البث (`BroadcastScreen`):** استبدال التأخير المحاكى باستدعاء `POST /api/rep/broadcast` واسترجاع السجل عبر `GET /api/rep/broadcasts`.
3. **ربط شاشة التسجيل (`RegisterScreen`):** استبدال التأخير المحاكى باستدعاء `POST /api/auth/register`.

---

## 12. P1 Tasks | المهام الهامة

1. **إنشاء نقطة التحديث (`/api/version`):** إرجاع كائن يحتوي على `latestVersion`, `minSupportedVersion`, `downloadUrl`, `releaseNotes`.
2. **نافذة التحديث داخل التطبيق (`UpdateDialog`):** عرض التنبيه الاختياري أو الإجباري عند إطلاق إصدار جديد.

---

## 13. P2 Tasks | التحسينات الثانوية

1. **إعادة تفعيل المزامنة التلقائية بالخلفية:** تشغيل مستمع `ConnectivityService` لاستدعاء `BackgroundSyncService.processQueueIfOnline()` تلقائياً.
2. **إشعارات Push (FCM):** إضافة حزمة Firebase عند فتح مجال إشعارات الأجهزة المغلقة.

---

## 14. Next Executive Decision | القرار التنفيذي القادم

> **تثبيت الهوية الرسمية وإنجاز المرحلة الأولى بنجاح. الخطوة القادمة هي الانتقال المباشر لربط الخدمات النواقص (Attendance, Broadcast, Register) بالنواحي الخلفية القائمة بالفعل دون التعديل على تصميم أو معمارية التطبيق.**

---

### 📝 نهاية التقرير التنفيذي للمرحلة 01
