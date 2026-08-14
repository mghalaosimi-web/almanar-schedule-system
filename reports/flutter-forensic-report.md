# 📱 FLUTTER APP FORENSIC HANDOFF REPORT — APP ONLY

**تاريخ التقرير:** 14 أغسطس 2026  
**اسم التقرير:** تقرير التحقيق الشامل والتدقيق الجنائي لتطبيق Flutter  
**المشروع:** تطبيق جداول كلية المنار الجامعية (`manar_schedule`)  
**نطاق المهمة:** التحقيق المستقل والشامل في تطبيق Flutter فقط دون تعديل الكود أو الـ Backend أو قواعد البيانات.

---

## 1. Flutter Project Identity | هية مشروع Flutter

- **Flutter Project Root:** `f:\almanar-college-system\mobile`
- **App Name:** `manar_schedule` (في `pubspec.yaml`)
- **Android App Label:** `جداول المنار` (في `AndroidManifest.xml`)
- **iOS Display Name:** `Manar Schedule` (في `Info.plist`)
- **Package Name / Namespace:** `com.mghal.manar_schedule`
- **Android applicationId:** `com.mghal.manar_schedule`
- **iOS Bundle Identifier:** `$(PRODUCT_BUNDLE_IDENTIFIER)` (افتراضي: `com.mghal.manarSchedule`)
- **Version Name:** `2.0.0`
- **Build Number (versionCode):** `2` (`version: 2.0.0+2` في `pubspec.yaml`)
- **Flutter SDK Constraint:** `^3.11.0` (Dart SDK 3.11.0+)
- **Target Platforms:** Android, iOS, Web, Windows, macOS, Linux (مكونات التهيئة كاملة لجميع المنصات)
- **Asset Directories:**
  - `assets/images/` (يحتوي على: `almanar_logo.png`, `logo.png`, `manar_logo.png`)
  - `assets/animations/` (مُصرَّح عنه في `pubspec.yaml` لكن المجلد فارغ حالياً)

---

## 2. Development History | تاريخ تطوير التطبيق

استناداً إلى سجل Commit الـ Git والملفات المصدرية:

1. **تاريخ البدء:** 26 يوليو 2026 (Commit: `44c4bfb` / `1c1c873` - `feat: add native Flutter mobile app project with schedule, tasks, forum and offline support`).
2. **التعديلات والتطوير:** 14 أغسطس 2026 (Commit: `e0ee1c4` - `feat: add Gamification, Focus mode (Pomodoro), Delegate QR & Poll tools, and Smart Forum features`).
3. **الهدف الأصلي:** بناء تطبيق جوال مستقل يعتمد على آلية **Offline-First** لتزويد طلاب ومندوبي ومحاضري كلية المنار الجامعية بالجدول الدراسي التفاعلي والإشعارات المحلية وإدارة الحضور والتعديلات الاستثنائية.
4. **ما تم تنفيذه:**
   - بنية التطبيق باستخدام `GoRouter` والهيكل الثنائي للملاحة (ShellRoute).
   - نظام المصادقة `AuthService` ودعم Offline Login عبر كاش `Hive`.
   - إدارة التخزين الآمن لـ JWT Token عبر `FlutterSecureStorage`.
   - خدمة الجداول `ScheduleService` مع DAO للكاش المحلي `ScheduleCacheDao`.
   - طابور المزامنة التلقائية عند العودة للإنترنت `SyncQueueDao` و `BackgroundSyncService`.
   - خدمة الإشعارات المحلية `LocalNotificationService` عبر `flutter_local_notifications`.
   - شاشات المندوب (تسجيل الحضور، الإرسال الجماعي، طلبات التعديل الاستثنائية).

---

## 3. Existing Features Inventory | جرد الميزات الموجودة فعلياً

| Feature (الميزة) | Status (الحالة) | Details (التفاصيل) |
|---|---|---|
| **Authentication (Login)** | `WORKING` / `CONNECTED` | مرتبط بـ `/api/auth/login` ويحفظ JWT في Secure Storage و `UserModel` في Hive. |
| **Offline Login** | `WORKING` / `CONNECTED` | عند غياب الشبكة يتيح الدخول من بيانات `UserModel` المخزنة محلياً. |
| **User Registration / Application** | `STUB` / `MOCK` | واجهة Form مكتملة لكن عند الإرسال تستخدم `Future.delayed(2s)` دون استدعاء API. |
| **Google Sign-In** | `PARTIALLY_IMPLEMENTED` | الزر متوفر، يستخدم حزمة `google_sign_in` ويستدعي `/auth/google` ولكن يتطلب ضبط النواحي الخلفية. |
| **Forgot Password / Request Creds** | `STUB` | شاشات تنبيهية Dialog محاكية بدون ربط خلفي. |
| **Schedule View (Cache-then-Network)** | `WORKING` / `CONNECTED` | يستجلب الجدول من `/api/schedules/my` أو الكاش المحلي فوراً ثم يحدّث بالخلفية. |
| **Day Selector & Today Schedule** | `WORKING` | فلترة جدول اليوم الحالي والأيام الدراسية. |
| **Delegate Attendance (الحضور)** | `STUB` / `MOCK` | واجهة مكتملة مع 12 طالب وهمي وشريط نسبة الحضور وإرسال محاكى بـ 2 ثانية delay. |
| **Delegate Broadcast (إشعارات المندوب)** | `STUB` / `MOCK` | واجهة مكتملة لإرسال الإشعار مع سجل وهمي وإرسال محاكى بـ 2 ثانية delay. |
| **Delegate Override Request (تعديل القاعات)** | `WORKING` / `CONNECTED` | مرتبط فعلياً بـ `POST /api/overrides/request` ويعرض إشعاراً محلياً ويخزن الطلب. |
| **Offline Sync Queue** | `PARTIALLY_IMPLEMENTED` | `SyncQueueDao` يخزن العمليات المؤجلة و `BackgroundSyncService` يرفعها عند عودة الإنترنت. |
| **Local Notifications** | `WORKING` | `LocalNotificationService` يرسل إشعارات التعديلات والمزامنة. |
| **Push Notifications (FCM)** | `NOT_IMPLEMENTED` | لا توجد حزم Firebase في `pubspec.yaml`. |
| **Theme Management (Dark/Light)** | `WORKING` | `ThemeProvider` يغير المظهر ويحفظ التفضيل في `SharedPreferences`. |
| **User Profile & Logout** | `WORKING` | يعرض بيانات الطالب والتخصص والشعبة والمستوى، ويتيح الخروج ومسح التوكن. |
| **Force Update / Version Gate** | `NOT_IMPLEMENTED` | لا يوجد كود أو شاشة في Flutter Dart تقوم بفحص الإصدار أو إجبار التحديث. |

---

## 4. Screens & Routes Inventory | جرد الشاشات والمسارات

1. **`SplashScreen`**
   - Route: `/splash`
   - File: `lib/features/auth/screens/splash_screen.dart`
   - Purpose: عرض شعار الكلية المتحرك والتحقق من حالة الدخول ثم التوجيه.
   - Status: `WORKING`
2. **`LoginScreen`**
   - Route: `/login`
   - File: `lib/features/auth/screens/login_screen.dart`
   - Purpose: تسجيل الدخول لجميع الأدوار (طالب، مندوب، محاضر) ودعم الدخول بدون إنترنت ودخول جوجل.
   - Status: `WORKING` / `CONNECTED`
3. **`RegisterScreen`**
   - Route: `/register`
   - File: `lib/features/auth/screens/register_screen.dart`
   - Purpose: نموذج طلب انضمام جديد للتطبيق/الكلية.
   - Status: `STUB` (واجهة مكتملة تظهر رسالة نجاح محاكاة)
4. **`HomeScreen`**
   - Route: `/`
   - File: `lib/features/home/screens/home_screen.dart`
   - Purpose: الصفحة الرئيسية، شارة الاتصال/الأوفلاين، إحصائيات سريعة، جدول محاضرات اليوم.
   - Status: `WORKING` / `CONNECTED`
5. **`ScheduleScreen`**
   - Route: `/schedule`
   - File: `lib/features/schedule/screens/schedule_screen.dart`
   - Purpose: عرض جدول الأسبوع الكامل، شريط اختيار اليوم، شارة الكاش القديم، زر التحديث.
   - Status: `WORKING` / `CONNECTED`
6. **`AttendanceScreen`** (خاص بالمندوب)
   - Route: `/attendance`
   - File: `lib/features/representative/screens/attendance_screen.dart`
   - Purpose: كشف حضور وغياب الطلاب للمندوب مع حساب نسبة الحضور.
   - Status: `STUB` (بيانات طلاب وهمية)
7. **`BroadcastScreen`** (خاص بالمندوب)
   - Route: `/broadcast`
   - File: `lib/features/representative/screens/broadcast_screen.dart`
   - Purpose: إرسال تنبيه عاجل للمجموعة من قبل المندوب.
   - Status: `STUB` (محاكاة إرسال وسجل وهمي)
8. **`OverrideRequestScreen`** (خاص بالمندوب)
   - Route: `/override-request`
   - File: `lib/features/representative/screens/override_request_screen.dart`
   - Purpose: رفع طلب تعديل قاعة أو تأجيل/تقديم محاضرة إلى شؤون الطلاب.
   - Status: `WORKING` / `CONNECTED`
9. **`ProfileScreen`**
   - Route: `/profile`
   - File: `lib/features/profile/screens/profile_screen.dart`
   - Purpose: عرض بيانات حساب المستخدم الحالي، رتبته (طالب/مندوب/محاضر)، وتأكيد الخروج.
   - Status: `WORKING`

---

## 5. App Architecture | بنية التطبيق النصية

```text
       ┌──────────────────────────────────────────────────────────┐
       │                   Flutter UI (GoRouter)                  │
       │ (Splash, Login, Home, Schedule, Attendance, Profile, ...) │
       └────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │             State Management (Provider)                  │
       │ (AuthService, ScheduleService, Connectivity, Theme)       │
       └──────────────┬────────────────────────────┬──────────────┘
                      │                            │
                      ▼                            ▼
       ┌────────────────────────────┐  ┌──────────────────────────┐
       │   Local Storage (Hive DAO) │  │  API Client (Dio + JWT)  │
       │ - ScheduleCacheDao         │  │ - BaseURL: 10.0.2.2:5001 │
       │ - SyncQueueDao             │  │ - SecureStorage (Token)  │
       │ - HiveBoxes (User/Settings)│  └───────────┬──────────────┘
       └──────────────┬─────────────┘              │
                      │                            │
                      ▼                            ▼
       ┌────────────────────────────┐  ┌──────────────────────────┐
       │     SQLite / Hive Disk     │  │   Node.js / Express Backend│
       └────────────────────────────┘  └──────────────────────────┘
```

### Offline Sync Architecture (طابور المزامنة):
```text
[Offline Action in App] ──► [SyncQueueDao.enqueue()] ──► [Hive Local Storage]
                                                              │
                                                     (Connection Restored)
                                                              │
[Server Database] ◄── [ApiClient.post()] ◄── [BackgroundSyncService.processQueue()]
```

---

## 6. API Connectivity Inventory | جرد الاتصال مع الـ APIs

| Method | Endpoint | Purpose | Auth Required | Status | Used By |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | تسجيل دخول موحد (طالب/مندوب/محاضر) | No | `CONNECTED` | `AuthService.login()` |
| `GET` | `/schedules/my` | جلب جدول الطالب الشخصي | Yes (Bearer) | `CONNECTED` | `ScheduleService._fetchFromServer()` |
| `GET` | `/schedules` | جلب جدول المجموعة حسب القسم والفرقة | Yes (Bearer) | `CONNECTED` | `ScheduleService._fetchFromServer()` |
| `GET` | `/public/schedules` | جلب الجدول العام في حال تعذر الدخول | No | `CONNECTED` | `ScheduleService` (Fallback) |
| `POST` | `/overrides/request` | رفع طلب تعديل قاعة/موعد | Yes (Bearer) | `CONNECTED` | `OverrideRequestScreen._submitOverrideRequest()` |
| `POST` | `/auth/google` | تسجيل الدخول برمز جوجل | No | `PARTIALLY_CONNECTED` | `LoginScreen._handleGoogleSignIn()` |
| `POST` | `/attendance` | رفع كشف الحضور والغياب | Yes (Bearer) | `UNUSED` (Code Stub) | `SyncItem` / `ApiEndpoints` |
| `POST` | `/notifications/broadcast` | إرسال بث جماعي للمجموعة | Yes (Bearer) | `UNUSED` (Code Stub) | `SyncItem` / `ApiEndpoints` |

---

## 7. Backend Relationship & Mismatches | العلاقة مع الـ Backend والتعارضات

- **Base URL:**
  - أجهزة الأندرويد المحاكية (Emulator): `http://10.0.2.2:5001/api`
  - الويب (Web): `http://localhost:5001/api`
  - التخصيص عند البناء: عبر خيار `--dart-define=API_BASE_URL=https://...`
- **التوقعات والتعارضات (Mismatches):**
  1. **الاستجابة لطلب تسجيل الدخول:** التطبيق يتوقع إما `token` أو `accessToken` داخل الـ response json بالإضافة لـ object `user`.
  2. **كشف الحضور:** التطبيق معرف به نقطة `/attendance` لكن الشاشة تستخدم بيانات وهمية محلياً.
  3. **بث المندوب:** التطبيق معرف به نقطة `/notifications/broadcast` لكن الشاشة تكتفي بالمحاكاة وتخزين النص في ذاكرة الشاشة `_history`.

---

## 8. Authentication & Security | آلية الدخول وتخزين التوكن

- **Token Storage:** يتم حفظ الـ JWT Token في الذاكرة المجهزة للتشفير `FlutterSecureStorage` باسم المفتاح `jwt_token`.
- **JWT Interceptor:** فئة `ApiClient` تضيف الترويسة `Authorization: Bearer <jwt_token>` تلقائياً لكل طلب HTTP خارجي.
- **Session Expiration:** عند تلقي كود الخطأ `401 Unauthorized` من السيرفر، يقوم الـ Interceptor تلقائياً باستدعاء `clearToken()`.
- **Offline Session:** يتم حفظ بيانات المستخدِم `UserModel` في صندوق Hive المسمى `current_user_box`. عند غياب الاتصال بالإنترنت، يقرأ التطبيق هذا الكاش ويسمح بالدخول الأوفلاين (`isOfflineLogin = true`).

---

## 9. Role-Based Access Control (RBAC) | إدارة الأدوار في Flutter

يقوم التطبيق بتحليل دور المستخدم من الحقل `roleStr` داخل `UserModel`:
- **`student` (طالب):** يتيح تصفح الشاشة الرئيسية والجدول الدراسي وحسابه الشخصي.
- **`representative` (مندوب):** يضيف 3 تبويبات رئيسية في شريط الملاحة السفلي:
  1. `/attendance` (كشف الحضور والغياب).
  2. `/broadcast` (إرسال إشعار للمجموعة).
  3. `/override-request` (تقديم طلب تعديل قاعة أو موعد).
- **`lecturer` (محاضر):** يتعامل معه التطبيق برتبة محاضر مع عرض الشاشات الأساسية.

---

## 10. Local Database (Hive & DAOs) | قاعدة البيانات المحلية

استبدل التطبيق استخدام Drift بـ **Hive** الخفيفة والمناسبة للـ Cross-Platform:

- **Type Adapters:**
  - `ScheduleEntryAdapter` (TypeId: 0)
  - `UserModelAdapter` (TypeId: 1)
- **Hive Boxes:**
  1. `schedules_box`: حفظ كائنات `ScheduleEntry`.
  2. `current_user_box`: حفظ كائن `UserModel`.
  3. `settings_box`: تفضيلات الوضع الليلي والإعدادات.
  4. `sync_queue_box`: طابور المزامنة التلقائية للعمليات المؤجلة.
- **Data Access Objects (DAOs):**
  - `ScheduleCacheDao`: يقدم وظائف `saveSchedules`, `getByDay`, `getAll`, `isCacheStale`, `clearAll`.
  - `SyncQueueDao`: يقدم وظائف `enqueue`, `getQueue`, `dequeue`, `pendingCount`.

---

## 11. Offline & Sync Status | حالة العمل أوفلاين والمزامنة

- **تصنيف التطبيق:** `Hybrid` / `Offline-Capable` (يعمل بمرونة بدون إنترنت).
- **البيانات المحفوظة كاش:** جلسة المستخدم، الجدول الدراسي الأسبوعي، طابور التعديلات.
- **استراتيجية الجداول:** **Cache-then-Network** (عرض الكاش فوراً للعميل لمنع الانتظار، ثم تحديث البيانات من السيرفر بالخلفية إن وُجد إنترنت).
- **آلية المزامنة التلقائية:** عند إضافة عملية أوفلاين (مثل طلب تعديل أو حضور)، تُدرج في `sync_queue_box`. تقوم خدمة `BackgroundSyncService` بالتحقق من العودة أونلاين وتمرير الطلبات بالسيرفر ثم إرسال إشعار للمستخدم بنجاح المزامنة.

---

## 12. Notifications System | نظام الإشعارات

- **`flutter_local_notifications` (v17.2.2):** `WORKING`
  - اسم القناة: `manar_schedule_channel` (تحديثات الجدول وإعلانات المنار).
  - تُستخدم لإصدار تنبيهات محلية فورية عند المزامنة الناجحة أو رفع طلبات التعديل.
- **Push Notifications (Firebase FCM):** `NOT_IMPLEMENTED`
  - التطبيق يفتقر لحزم Firebase في `pubspec.yaml` وملف `google-services.json`.

---

## 13. Android Configuration | إعدادات نظام أندرويد

- **Build Configuration:** `android/app/build.gradle.kts`
- **Application ID:** `com.mghal.manar_schedule`
- **Namespace:** `com.mghal.manar_schedule`
- **Version Code:** `2`
- **Version Name:** `2.0.0`
- **Compile SDK:** Flutter Default (SDK 34)
- **Java Compatibility:** Java 17 (مع تفعيل `isCoreLibraryDesugaringEnabled = true` عبر `com.android.tools:desugar_jdk_libs:2.0.4`).
- **Permissions:** `INTERNET`, `ACCESS_NETWORK_STATE`.
- **Signing Config:** مضبوط حالياً لاستخدام مفتاح الـ `debug` في إصدارات Release.

---

## 14. APK / Release History | حزم الـ APK المبنية في المشروع

تم العثور على حزمتين APK مبنيتين داخل المجلد `mobile/build/app/outputs/`:

1. **`app-debug.apk` (Debug Build):**
   - Path: `mobile/build/app/outputs/apk/debug/app-debug.apk`
   - Size: 186.87 MB (186,874,776 bytes)
   - Date: 13 أغسطس 2026 الساعة 06:11 AM
2. **`app-release.apk` (Release Build):**
   - Path: `mobile/build/app/outputs/apk/release/app-release.apk`
   - Size: 56.50 MB (56,501,487 bytes)
   - Date: 13 أغسطس 2026 الساعة 06:14 AM
   - **ملاحظة هامة:** هذه الحزمة تم نسخها أيضاً وتوفيرها للتحميل المباشر في موقع الويب عبر `frontend/public/Manar_Schedule.apk`.

---

## 15 & 16. Current Incident: Update Requirement Diagnosis | تحقيق سبب طلب التحديث

### 🔴 النتيجة النهائية للتحقيق في سبب طلب التحديث:

> **لا يوجد أي كود أو شاشة أو شرط فحص إصدار (Version Gate / Force Update) داخل مشروع Flutter (Dart) إطلاقاً.**

1. **التقصي في كود Flutter:**
   - تم إجراء فحص شامل لكلمات (`forceUpdate`, `minimumVersion`, `versionCode`, `latestVersion`, `updateRequired`).
   - لا توجد أي واجهة تنبيه أو نافذة POP-UP تطلب من المستخدم التحديث داخل التطبيق.
2. **مصدر الإصدار الحالي:**
   - التطبيق المثبت والمبنى يحمل الإصدار `version: 2.0.0+2` (Version 2.0.0, Code 2).
3. **سبب المشكلة (Incident Root Cause):**
   - إذا ظهر للمستخدم أو الموقع إشعار يطالب بتحديث التطبيق، فإن ذلك يعود لـ **عنصر خارجي في الـ Backend أو موقع الويب** (مثل `sessionTracker.js` في الـ Backend الذي يحتوي على `appVersion: '3.5.0'`), أو أن المتصفح/النظام يعرض تنبيهاً بسبب تعارض رقم الإصدار بين السيرفر والنسخة المحملة.
   - **`UPDATE REQUIREMENT CAUSE: EXTERNAL_BACKEND_OR_METADATA_MISMATCH`**

---

## 17. Google Play & Store Configuration

- **Store Status:** لم يتم النشر على Google Play بعد (`publish_to: 'none'`).
- **Package ID:** `com.mghal.manar_schedule`

---

## 18. Assets & Media Audit | فحص الملفات الملحقة

- **الموجود:**
  - `assets/images/logo.png` (موجود وحجمه 651 KB).
  - `assets/images/almanar_logo.png` (موجود وحجمه 651 KB).
  - `assets/images/manar_logo.png` (موجود وحجمه 593 KB).
- **المفقود / النواقص:**
  - `assets/animations/` مُعرّف في ملف `pubspec.yaml` ولكن المجلد فارغ تماماً من ملفات Lottie `.json`.

---

## 19. Dependencies Audit | جرد المكتبات

- **Core & Navigation:** `provider` (6.1.2), `go_router` (14.2.7).
- **Storage & Security:** `hive` (2.2.3), `hive_flutter` (1.1.0), `flutter_secure_storage` (9.2.2), `shared_preferences` (2.2.2).
- **Networking:** `dio` (5.4.0), `http` (1.2.0), `connectivity_plus` (6.0.3).
- **UI & Animations:** `google_fonts` (6.1.0), `flutter_animate` (4.5.0), `shimmer` (3.0.0), `lottie` (3.1.0).
- **Utilities:** `flutter_local_notifications` (17.2.2), `url_launcher` (6.2.4), `intl` (0.19.0), `google_sign_in` (6.2.1).

---

## 20. Code Health & Stub Inventory | صحة الكود والأجزاء المحاكاة

1. `lib/features/representative/screens/attendance_screen.dart`: يحتوي على قائمة وهمية لـ 12 طالب وتأخير زمني `Future.delayed(2s)` عند الحفظ.
2. `lib/features/representative/screens/broadcast_screen.dart`: يحتوي على سجل إشعارات وهمي وتأخير زمني `Future.delayed(2s)` عند الإرسال.
3. `lib/features/auth/screens/register_screen.dart`: نموذج واجهة مكتمل ولكنه يكتفي بـ `Future.delayed(2s)` دون الاتصال بـ `/auth/register`.

---

## 21. Hardcoded Credentials & Secrets | فحص الأسرار

- لا توجد أي كلمات مرور أو مفاتيح تشفير خاصة أو توكنات حقيقية مكتوبة كـ Hardcoded داخل الكود.
- عناوين الـ API مضموطة على النطاق المحلي للاختبار `http://10.0.2.2:5001/api` و `http://localhost:5001/api`.

---

## 22. Flutter <-> ERP/Backend Integrations Summary

- **المتصل حالياً:** تسجيل الدخول الموحد (`/auth/login`)، جلب جدول الطالب (`/schedules/my`)، رفع طلبات التعديل الاستثنائية (`/overrides/request`).
- **المفقود / غير المربوط:** كشف الحضور للطلاب، البث الجماعي للمندوب، طلب الانضمام والتسجيل الجديد.

---

## 23. Existing Feature Status Matrix

| FEATURE | EXISTS | WORKING | CONNECTED | TESTED | MISSING LINKS |
|---|---|---|---|---|---|
| Login / Auth | YES | YES | YES | YES | None |
| Offline Session | YES | YES | YES | YES | None |
| Schedule View | YES | YES | YES | YES | None |
| Override Request | YES | YES | YES | YES | None |
| Local Notifications| YES | YES | YES | YES | Push (FCM) missing |
| Attendance Screen | YES | PARTIAL| NO | NO | Needs Backend Attendance API |
| Broadcast Screen | YES | PARTIAL| NO | NO | Needs Backend Broadcast API |
| Registration Screen| YES | PARTIAL| NO | NO | Needs Backend Register API |
| Force Update Check | NO | NO | NO | NO | Feature not implemented in Flutter |

---

## 24. Local Execution & Runtime Verification

- مشروع Flutter خالي من أخطاء التجميع الهيكلية.
- ملفات الـ APK المبنية مسبقاً تعمل بنجاح وتحمل الرقم التشغيلي `2.0.0+2`.

---

## 25. Account Roles & Testing Summary

- التطبيق يدعم الأدوار الثلاثة بشكل ديناميكي بناءً على استجابة الـ Backend: `student`, `representative`, `lecturer`.

---

## 26. CURRENT APP INCIDENT SUMMARY

1. **حالة التطبيق:** التطبيق يعمل بصورة ممتازة بالنسبة لوظائف عرض الجدول ودعم الأوفلاين وتسجيل الدخول الموحد ورفع طلبات التعديل.
2. **سبب التوقف أو طلب التحديث:** لا يوجد أيVersion Gate في كود التطبيق، والمشكلة ناتجة إما عن تباين رقم الإصدار المعرف في Backend `sessionTracker.js` (`3.5.0`) مقارنة بإصدار التطبيق الحجمي (`2.0.0`), أو تعارض في البيانات الوصفية أثناء التنزيل.
3. **لا تتطلب هذه المشكلة إعادت بناء التطبيق.**

---

## 27. Missing Links & Actionable Tasks

1. ربط واجهة الحضور والغياب `AttendanceScreen` بالنقطة النهائية المعتمدة في السيرفر.
2. ربط واجهة البث الجماعي `BroadcastScreen` بنقطة الإشعارات المعتمدة.
3. ربط واجهة التسجيل الجديد `RegisterScreen` بنقطة إنشاء الحساب المعتمدة.
4. توحيد ثوابت رقم الإصدار بين Flutter Backend و Web distribution (الرفع إلى `2.0.0+2` أو ما يحدده المشرف).

---

# 🚀 HANDOFF FOR NEXT AGENT

> **نسخة جاهزة للتمرير المباشر للوكيل القادم لاستكمال العمل دون إعادة البناء**

```text
================================================================================
                    FLUTTER APP HANDOFF - DO NOT REBUILD
================================================================================

APP PURPOSE:
Standalone Offline-First Flutter Mobile Application for Al-Manar University College.
Allows students, representatives, and lecturers to view schedules, handle offline cache,
receive local notifications, and send schedule override requests.

CURRENT ARCHITECTURE:
- Framework: Flutter 3.x / Dart 3.11+
- Navigation: GoRouter with ShellRoute (_MainShell)
- State Management: Provider (AuthService, ScheduleService, ConnectivityService, ThemeProvider)
- Local DB & Cache: Hive (ScheduleCacheDao, SyncQueueDao, HiveBoxes)
- Secure Storage: FlutterSecureStorage (JWT Token: 'jwt_token')
- HTTP Client: Dio with JWT Bearer Interceptor & 401 Expiration Handler

WHAT IS ALREADY IMPLEMENTED & WORKING:
- Authentication & JWT persistence (/api/auth/login)
- Offline login using cached UserModel in Hive
- Personal & Group Schedule fetching with Cache-then-Network strategy (/api/schedules/my)
- Schedule Override Request posting with local notification alert (/api/overrides/request)
- Theme switching (Dark/Light) using SharedPreferences
- User Profile screen & Logout
- Local Notification Service via flutter_local_notifications

WHAT IS PARTIAL / STUBBED IN UI:
- AttendanceScreen (/attendance): UI built, currently uses 12 mock students & 2s delay.
- BroadcastScreen (/broadcast): UI built, currently uses mock notification history & 2s delay.
- RegisterScreen (/register): UI built, currently uses 2s delay mockup instead of API.
- Google Sign-In: UI button & GoogleSignIn package configured, targets /auth/google.

CURRENT UPDATE ISSUE & VERSION STATE:
- Installed/Built App Version: 2.0.0+2 (versionName: 2.0.0, versionCode: 2)
- App Release APK Location: mobile/build/app/outputs/apk/release/app-release.apk (56.5 MB)
- Web Distribution APK: frontend/public/Manar_Schedule.apk (Identical build 2.0.0+2)
- Update Issue Finding: NO Version Gate or Force Update code exists in Flutter Dart.
  If an update prompt appears, it originates from external backend sessionTracker metadata
  (where appVersion is hardcoded as '3.5.0') or web links.

API CONTRACTS USED:
- POST /api/auth/login (payload: {email, studentId, password, role}) -> returns {token, user}
- GET  /api/schedules/my (Bearer Token) -> returns schedules array
- POST /api/overrides/request (payload: {subject, day, type, newRoom, newTime, reason})

DO NOT REBUILD THESE PARTS:
- Do NOT rewrite the Flutter project structure.
- Do NOT replace GoRouter or Provider state management.
- Do NOT delete Hive or replace it with another local database.
- Do NOT recreate the LoginScreen, HomeScreen, ScheduleScreen, or ProfileScreen.

NEXT REQUIRED WORK (ONLY MISSING LINKS):
1. Connect AttendanceScreen to the real backend attendance endpoint.
2. Connect BroadcastScreen to the real backend broadcast notification endpoint.
3. Connect RegisterScreen to the real backend registration endpoint.
4. Synchronize app version metadata in Backend (e.g. sessionTracker.js) to match '2.0.0'.

================================================================================
```
