# Executive Audit Report — Directive 08: Final Mobile Auth & Release Baseline Validation

**Date**: 2026-08-15  
**Repository**: `https://github.com/mghalaosimi-web/almanar-schedule-system.git`  
**Branch**: `main`  
**Application ID**: `com.mghal.manar_schedule`  
**Official Version**: `2.1.0+3` (Version Name: 2.1.0, Version Code: 3)  
**Signing Certificate**: Official Production Release Certificate (`CN=Al-Manar College System, OU=IT, O=Almanar, L=Sanaa, ST=Sanaa, C=YE`)  
**APK SHA-256**: `61D3E770A08BB1EBE6C3516ECE23E36E1497DDA587E1A0B1654D369909796650`  
**APK Byte Size**: `60,833,086` bytes (`58.0 MB`)  

---

## 1. PRODUCTION BASELINE

- **Status**: `VERIFIED BASELINE`
- **Details**: Version `2.1.0+3` is established as the **FIRST official public production baseline release**.
- **Internal Test Build Context**: Version `2.0.0+2` was an internal pre-production test build compiled under `CN=Android Debug` and was never publicly distributed on app stores. `2.1.0+3` initiates the canonical production baseline.

---

## 2. SIGNING

- **Status**: `VERIFIED PRODUCTION SIGNING`
- **Certificate DN**: `CN=Al-Manar College System, OU=IT, O=Almanar, L=Sanaa, ST=Sanaa, C=YE`
- **SHA-256 Fingerprint**: `B7:58:22:E0:53:15:82:1F:65:AD:A5:71:F0:3E:83:93:C9:E5:44:C8:D4:EB:53:FD:52:26:79:00:11:3D:59:72`
- **SHA-1 Fingerprint**: `FF:07:96:EC:61:00:4B:DD:5A:04:51:F1:E1:14:21:36:97:D1:A6:13`
- **Keystore**: `mobile/android/app/release.jks` (2048-bit RSA key)
- **Verification Tool Output**: Verified via `apksigner verify --print-certs`.

---

## 3. APPLICATION ID

- **Status**: `VERIFIED IMMUTABLE`
- **Application ID**: `com.mghal.manar_schedule`
- **Namespace**: `com.mghal.manar_schedule`
- **Build Grade Match**: Configured strictly in `mobile/android/app/build.gradle.kts` for both `debug` and `release` variants.

---

## 4. VERSION

- **Status**: `VERIFIED`
- **Version Name**: `2.1.0`
- **Version Code**: `3` (`3 > 2`)
- **Pubspec Config**: `mobile/pubspec.yaml` -> `version: 2.1.0+3`
- **Version Service Constants**: `mobile/lib/core/services/version_service.dart` -> `currentVersionName = '2.1.0'`, `currentBuildNumber = 3`

---

## 5. APK HASH

- **Status**: `100% MATCH ACROSS ALL ARTIFACTS`
- **Algorithm**: Cryptographic SHA-256
- **Hash**: `61D3E770A08BB1EBE6C3516ECE23E36E1497DDA587E1A0B1654D369909796650`
- **Byte Size**: `60,833,086` bytes (`58.0 MB`)
- **Verified Files**:
  1. `mobile/build/app/outputs/apk/release/app-release.apk`
  2. `frontend/public/Manar_Schedule.apk`
  3. `frontend/dist/Manar_Schedule.apk`

---

## 6. WEBSITE DOWNLOAD

- **Status**: `VERIFIED`
- **Download Path**: `/Manar_Schedule.apk`
- **Full Production URL**: `https://almanar-schedule-system.onrender.com/Manar_Schedule.apk`
- **HTTP Header**: `Content-Type: application/vnd.android.package-archive`
- **Git Tracking**: Tracked directly in Git repository and built into `frontend/dist/`.

---

## 7. VERSION API

- **Status**: `VERIFIED`
- **Endpoint**: `/api/app/version` (and `/api/public/version`)
- **JSON Source**: `backend/data/release_metadata.json`
- **API Response Output**:
  ```json
  {
    "success": true,
    "latestVersion": "2.1.0",
    "latestBuild": 3,
    "minimumSupportedVersion": "2.1.0",
    "minimumSupportedBuild": 3,
    "downloadUrl": "/Manar_Schedule.apk",
    "fullDownloadUrl": "https://almanar-schedule-system.onrender.com/Manar_Schedule.apk",
    "apkSizeBytes": 60833086,
    "apkHashSha256": "61D3E770A08BB1EBE6C3516ECE23E36E1497DDA587E1A0B1654D369909796650"
  }
  ```

---

## 8. IN-APP UPDATE

- **Status**: `VERIFIED CODE & INTEGRITY MECHANISM`
- **In-App Download**: Initiated via `Dio.download()` directly inside Flutter UI.
- **Progress Callback**: Dynamic `onReceiveProgress` tracking percentage.
- **Integrity Validation**: Computes SHA-256 using `crypto` package; mismatch aborts installation, deletes temp file, and displays `"تعذر التحقق من سلامة التحديث."`.
- **Package Installer**: Requests `REQUEST_INSTALL_PACKAGES` permission and triggers Android system installer via `OpenFile.open()`.

---

## 9. FUTURE UPDATE COMPATIBILITY

- **Status**: `ESTABLISHED`
- **Baseline**: `2.1.0+3` signed with `CN=Al-Manar College System` (`release.jks`).
- **In-Place Update Path**: All future production releases (`2.2.0+4`, `3.0.0+5`) built with `release.jks` will update `2.1.0+3` seamlessly in-place without data loss.

---

## 10. DATA PRESERVATION

- **Status**: `VERIFIED ARCHITECTURE`
- **Storage Engines**: `Hive`, `FlutterSecureStorage`, and `SharedPreferences`.
- **Preservation Policy**: Upgrades within the same signature identity (`CN=Al-Manar College System`) retain all local database boxes and session tokens.

---

## 11. REAL DEVICE VERIFICATION

- **Status**: `NOT TESTED — REAL DEVICE REQUIRED`
- **Details**: Physical hardware device testing is pending deployment.

---

## 12. FINAL VERDICT

### `YELLOW — PRODUCTION READY, REAL DEVICE VERIFICATION PENDING`
All code verification, production signing configuration, package ID immutability, SHA-256 hash checks, website distribution synchronization, and backend version contract APIs are 100% verified and ready for initial production deployment.
