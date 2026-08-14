# 🚀 FLUTTER P1 INTEGRATION REPORT — OFFICIAL APP UPDATE SYSTEM

**التاريخ:** 15 أغسطس 2026  
**الصفة:** EXECUTIVE TECHNICAL LEAD & PRODUCT DIRECTOR  
**المشروع:** نظام التحديث الرسمي لتطبيق جداول المنار (`manar_schedule`)  
**المسار:** `F:\almanar-college-system`

---

## 1. Existing Release Metadata Audit | كشف وفحص التحديثات السابقة

- **كشف المشكلة السابقة:** كانت هناك إشارة محاكاة قديمة لإصدار وهمي `3.5.0` متواجدة داخل كود تتبع الجلسات `sessionTracker.js` دون وجود نظام فحص حقيقي في التطبيق.
- **التصحيح التام:** تم تعديل ملف `sessionTracker.js` ليتطابق مع الإصدار الرسمي الحقيقي للمشروع `2.0.0`.

---

## 2. Current APK Audit & Hashes | مطابقة ملف الـ APK الرسمي

تم إجراء فحص تجزئة (Cryptographic SHA-256 Hash Audit) للمقارنة بين ملف الـ APK المرفوع بالموقع والملف المبني في Flutter:

```text
File 1: frontend/public/Manar_Schedule.apk
File 2: mobile/build/app/outputs/apk/release/app-release.apk

SHA-256 Hash: 34EF2EDF88A5879A0CDA0EEBE4A16593B6D22F4E0A20E907F5C152246FF6399C
Exact Size:   56,501,487 bytes (53.88 MB)
Version:      2.0.0+2 (versionName: 2.0.0, buildNumber: 2)
Match Status: 100% IDENTICAL MATCH (كلا الملفين هما نفس النسخة الرسمية الحقيقية)
```

---

## 3. Release Source of Truth | مصدر الحقيقة الموحد

تم إنشاء ملف بيانات وصفية موحد للـ Release في السيرفر:
- **المسار:** `backend/data/release_metadata.json`
- **الدور:** يُمثّل المصدر الوحيد والملزم لإصدار التطبيق لكل من تطبيق الهاتف والمنصة الإلكترونية.

---

## 4. API Contract | عقد API فحص الإصدار

```http
GET /api/app/version  (أو /api/public/version)
Response:
{
  "success": true,
  "latestVersion": "2.0.0",
  "latestBuild": 2,
  "minimumSupportedVersion": "2.0.0",
  "minimumSupportedBuild": 2,
  "downloadUrl": "/Manar_Schedule.apk",
  "fullDownloadUrl": "https://almanar-schedule-system.onrender.com/Manar_Schedule.apk",
  "apkSizeBytes": 56501487,
  "apkHashSha256": "34EF2EDF88A5879A0CDA0EEBE4A16593B6D22F4E0A20E907F5C152246FF6399C",
  "releaseNotes": [
    "الإصدار الرسمي لتطبيق جداول المنار (Offline-First)",
    "عرض الجداول الدراسية والتعديلات الاستثنائية فورياً",
    "دعم كامل لإرسال واستقبال الحضور والبث الجماعي للمندوبين"
  ],
  "releaseDate": "2026-08-15"
}
```

---

## 5. Version Comparison Logic | محرك مقارنة الإصدارات

تم بناء خدمة `VersionService` في Flutter بمحرك مقارنة سيمانتيك قياسي (`Semantic Versioning Comparator`):
1. يفصل رقم الإصدار `major.minor.patch` ويبدأ بالمقارنة المباشرة.
2. في حال التساوي في رقم الإصدار، يقارن رقم البناء `buildNumber`.
3. يُرجع حالة التحديث بدقة:
   - `current == latest`: التطبيق محدث بالكامل (لا يظهر حوار).
   - `current < latest` وَ `current >= minimumSupported`: تحديث اختياري (`Optional Update`).
   - `current < minimumSupported`: تحديث إجباري (`Mandatory Update`).

---

## 6. Optional Update Flow | مسار التحديث الاختياري

- **المحفز:** إصدار السيرفر أحدث من التطبيق لكن الإصدار الحالي لا يزال مدعوماً (`current >= minimumSupported`).
- **المظهر:** حوار زجاجي أنيق متوافق مع ثيم المنار (RTL / Arabic).
- **الخيارات:** زر `[تحديث الآن]` يفتح رابط الـ APK المباشر عبر `url_launcher` وزر `[لاحقاً]` لإغلاق الحوار والمتابعة.

---

## 7. Mandatory Update Flow | مسار التحديث الإجباري

- **المحفز:** إصدار التطبيق أقدم من الحد الأدنى المدعوم (`current < minimumSupported`).
- **المظهر:** حوار إجباري غير قابل للإغلاق (`barrierDismissible: false`, `willPop: false`).
- **الخيارات:** زر `[تحديث الآن]` فقط، مع حظر التراجع لمنع استخدام نسخ غير مدعومة.

---

## 8. Offline Behavior | السلوك عند انقطاع الشبكة

- في حال عدم توفر اتصال بالإنترنت أو تعذر السيرفر:
  - يقوم التطبيق بقراءة آخر Metadata محفوظة محلياً في `Hive (settings_box)`.
  - لا يتسبب خطأ الشبكة العابر في إغلاق أو تعطيل فتح التطبيق.

---

## 9. Website Download Integration | تكامل الموقع الإلكتروني

- تم توحيد الواجهة في الموقع (`frontend/src/components/PWAInstallModal.jsx`) لتعرض نفس بيانات الإصدار `2.0.0 (Build 2)` وحجم الملف `53.8 MB` ليكون الموقع والتطبيق متطابقين تماماً.

---

## 10. Release Notes | ملاحظات الإصدار

- تُعرض قائمة مميزات الإصدار ديناميكياً من كائن `releaseNotes` القادم من السيرفر، وتظهر في الحوار على شكل نقاط واضحة دون الحاجة لإدخال نص ثانٍ داخل كود التطبيق.

---

## 11. Files Changed | الملفات المعدلة والمضافة

1. `backend/data/release_metadata.json` (جديد): مصدر الحقيقة الموحد لإصدار التطبيق.
2. `backend/src/server.js`: إضافة endpoint `/api/app/version`.
3. `backend/src/routes/public.js`: إضافة endpoint `/api/public/version`.
4. `backend/src/services/sessionTracker.js`: تصحيح قيمة `appVersion` إلى `2.0.0`.
5. `mobile/lib/core/services/version_service.dart` (جديد): محرك مقارنة الإصدارات وحوار التحديث الزجاجي.
6. `mobile/lib/features/auth/screens/splash_screen.dart`: ربط بوابة فحص الإصدار عند تشغيل التطبيق.
7. `frontend/src/components/PWAInstallModal.jsx`: تحديث نصوص ومعلومات الـ APK في نافذة التنزيل بالموقع.

---

## 12. Tests Performed | الاختبارات والتحقق المنفذ

- **Case 1 (Current = Latest = 2.0.0):** يفتح التطبيق مباشرة دون إظهار حوار.
- **Case 2 (Optional Update Test):** تم فحص المنطق وتأكيد ظهور زر "لاحقاً".
- **Case 3 (Mandatory Update Test):** تم فحص المنطق وتأكيد حظر التراجع وإغلاق الحوار.
- **Case 4 (Offline Fallback):** استمرار فتح التطبيق عند غياب الشبكة دون انهيار.

---

## 13. Current Version | الإصدار الحقيقي الحالي

```text
App Name:     manar_schedule
Version Name: 2.0.0
Build Number: 2
Full String:  2.0.0+2
```

---

## 14. Next Release Procedure | الدليل التشغيلي القياسي للإصدارات القادمة (SOP)

عند الرغبة في إطلاق إصدار جديد (مثلاً `2.1.0+3`) في المستقبل، يرجى اتباع الخطوات التسلسلية التالية:

1. **تحديث إصدار Flutter:**
   تعديل `mobile/pubspec.yaml`:
   ```yaml
   version: 2.1.0+3
   ```
2. **تحديث الثابت المحلي:**
   تعديل الثوابت في `mobile/lib/core/services/version_service.dart`:
   ```dart
   static const String currentVersionName = '2.1.0';
   static const int currentBuildNumber = 3;
   ```
3. **بناء حزمة APK الـ Release:**
   تشغيل الأمر في مجلد `mobile`:
   ```bash
   flutter build apk --release
   ```
4. **حساب التجزئة وتحديث ملفات التوزيع:**
   نسخ الملف الناتج من `mobile/build/app/outputs/apk/release/app-release.apk` إلى `frontend/public/Manar_Schedule.apk`.
5. **تحديث مصدر الحقيقة في السيرفر:**
   تعديل `backend/data/release_metadata.json`:
   ```json
   {
     "latestVersion": "2.1.0",
     "latestBuild": 3,
     "minimumSupportedVersion": "2.0.0",
     "minimumSupportedBuild": 2,
     "releaseNotes": ["ملاحظات الإصدار الجديد..."],
     "releaseDate": "2026-09-01"
   }
   ```
6. **التحقق التجريبي:**
   التأكد من أن الاستجابة من `/api/app/version` تعود بالبيانات الجديدة.
7. **الاعتماد والتأكيد:**
   تطبيق التحديث بنجاح.
