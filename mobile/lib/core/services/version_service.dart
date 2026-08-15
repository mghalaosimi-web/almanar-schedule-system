import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_file/open_file.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../data/remote/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/gradient_button.dart';
import '../constants/api_endpoints.dart';

/// كائن نتائج فحص التحديث
class VersionCheckResult {
  final bool hasUpdate;
  final bool isMandatory;
  final String latestVersion;
  final int latestBuild;
  final String minimumSupportedVersion;
  final int minimumSupportedBuild;
  final String downloadUrl;
  final int? apkSizeBytes;
  final String? apkHashSha256;
  final List<String> releaseNotes;
  final String releaseDate;

  VersionCheckResult({
    required this.hasUpdate,
    required this.isMandatory,
    required this.latestVersion,
    required this.latestBuild,
    required this.minimumSupportedVersion,
    required this.minimumSupportedBuild,
    required this.downloadUrl,
    this.apkSizeBytes,
    this.apkHashSha256,
    required this.releaseNotes,
    required this.releaseDate,
  });
}

/// خدمة فحص ومقارنة وتنزيل التحديثات (Single Source of Truth)
class VersionService {
  static const String currentVersionName = '2.1.0';
  static const int currentBuildNumber = 3;

  /// مقارنة إصدارين سيمانتيك (Semantic Versioning Comparator)
  static bool isVersionOlder(
    String currentVer,
    int currentBuild,
    String targetVer,
    int targetBuild,
  ) {
    List<int> parseParts(String v) {
      return v.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    }

    final currentParts = parseParts(currentVer);
    final targetParts = parseParts(targetVer);

    final maxLen = currentParts.length > targetParts.length
        ? currentParts.length
        : targetParts.length;

    for (int i = 0; i < maxLen; i++) {
      final c = i < currentParts.length ? currentParts[i] : 0;
      final t = i < targetParts.length ? targetParts[i] : 0;

      if (c < t) return true;
      if (c > t) return false;
    }

    return currentBuild < targetBuild;
  }

  /// إجراء فحص الإصدار الحقيقي مع السيرفر
  static Future<VersionCheckResult> checkVersion() async {
    try {
      final api = ApiClient();
      Response response;
      try {
        response = await api.get('/app/version');
      } catch (_) {
        response = await api.get('/public/version');
      }

      if (response.data != null && response.statusCode == 200) {
        final Map<String, dynamic> data = response.data is String
            ? {}
            : Map<String, dynamic>.from(response.data as Map);

        final latestVer = data['latestVersion'] as String? ?? currentVersionName;
        final latestBld = (data['latestBuild'] as num?)?.toInt() ?? currentBuildNumber;
        final minVer = data['minimumSupportedVersion'] as String? ?? currentVersionName;
        final minBld = (data['minimumSupportedBuild'] as num?)?.toInt() ?? currentBuildNumber;
        final rawDownloadUrl = data['downloadUrl'] as String? ?? '/Manar_Schedule.apk';
        final sizeBytes = (data['apkSizeBytes'] as num?)?.toInt();
        final hashSha256 = data['apkHashSha256'] as String?;

        final notesList = (data['releaseNotes'] as List?)
                ?.map((e) => e.toString())
                .toList() ??
            ['إصدار جديد متوفر لتطبيق جداول المنار.'];

        final relDate = data['releaseDate'] as String? ?? '2026-08-15';

        final hasUpdate = isVersionOlder(
          currentVersionName,
          currentBuildNumber,
          latestVer,
          latestBld,
        );

        final isMandatory = isVersionOlder(
          currentVersionName,
          currentBuildNumber,
          minVer,
          minBld,
        );

        // حفظ آخر نتيجة فحص محلياً لضمان العمل Offline
        try {
          final box = Hive.box('settings_box');
          await box.put('last_version_metadata', {
            'latestVersion': latestVer,
            'latestBuild': latestBld,
            'minimumSupportedVersion': minVer,
            'minimumSupportedBuild': minBld,
            'downloadUrl': rawDownloadUrl,
            'apkSizeBytes': sizeBytes,
            'apkHashSha256': hashSha256,
            'releaseNotes': notesList,
            'releaseDate': relDate,
          });
        } catch (_) {}

        return VersionCheckResult(
          hasUpdate: hasUpdate,
          isMandatory: isMandatory,
          latestVersion: latestVer,
          latestBuild: latestBld,
          minimumSupportedVersion: minVer,
          minimumSupportedBuild: minBld,
          downloadUrl: rawDownloadUrl,
          apkSizeBytes: sizeBytes,
          apkHashSha256: hashSha256,
          releaseNotes: notesList,
          releaseDate: relDate,
        );
      }
    } catch (e) {
      debugPrint('[VersionService] Version check network call failed: $e');
    }

    // fallback: القراءة من التخزين المحلي فور انقطاع الشبكة
    try {
      final box = Hive.box('settings_box');
      final cached = box.get('last_version_metadata') as Map?;
      if (cached != null) {
        final minVer = cached['minimumSupportedVersion'] as String? ?? currentVersionName;
        final minBld = (cached['minimumSupportedBuild'] as num?)?.toInt() ?? currentBuildNumber;
        final latestVer = cached['latestVersion'] as String? ?? currentVersionName;
        final latestBld = (cached['latestBuild'] as num?)?.toInt() ?? currentBuildNumber;

        final isMandatory = isVersionOlder(
          currentVersionName,
          currentBuildNumber,
          minVer,
          minBld,
        );

        final hasUpdate = isVersionOlder(
          currentVersionName,
          currentBuildNumber,
          latestVer,
          latestBld,
        );

        return VersionCheckResult(
          hasUpdate: hasUpdate,
          isMandatory: isMandatory,
          latestVersion: latestVer,
          latestBuild: latestBld,
          minimumSupportedVersion: minVer,
          minimumSupportedBuild: minBld,
          downloadUrl: cached['downloadUrl'] as String? ?? '/Manar_Schedule.apk',
          apkSizeBytes: (cached['apkSizeBytes'] as num?)?.toInt(),
          apkHashSha256: cached['apkHashSha256'] as String?,
          releaseNotes: (cached['releaseNotes'] as List?)?.map((e) => e.toString()).toList() ?? [],
          releaseDate: cached['releaseDate'] as String? ?? '',
        );
      }
    } catch (_) {}

    return VersionCheckResult(
      hasUpdate: false,
      isMandatory: false,
      latestVersion: currentVersionName,
      latestBuild: currentBuildNumber,
      minimumSupportedVersion: currentVersionName,
      minimumSupportedBuild: currentBuildNumber,
      downloadUrl: '/Manar_Schedule.apk',
      releaseNotes: [],
      releaseDate: '',
    );
  }

  /// إظهار حوار التحديث إذا كان التحديث متوفراً
  static Future<bool> promptUpdateIfAvailable(BuildContext context) async {
    final result = await checkVersion();
    if (!result.hasUpdate && !result.isMandatory) {
      return false;
    }

    if (!context.mounted) return false;

    await showDialog(
      context: context,
      barrierDismissible: !result.isMandatory,
      builder: (ctx) => PopScope(
        canPop: !result.isMandatory,
        child: _UpdateDialogWidget(result: result),
      ),
    );

    return true;
  }

  /// تنزيل التحديث داخل التطبيق مع التحقق من SHA-256 وفتح أداة التثبيت الرسمية
  static Future<void> downloadAndInstallApk({
    required String downloadUrl,
    int? expectedSizeBytes,
    String? expectedSha256,
    required Function(double progress) onProgress,
    required Function(String status) onStatusChange,
  }) async {
    String url = downloadUrl;
    if (!url.startsWith('http')) {
      final base = ApiEndpoints.baseUrl.replaceAll('/api', '');
      url = '$base$url';
    }

    onStatusChange('جاري التحضير لتنزيل التحديث...');

    // 1. تحديد مسار التنزيل المحلي
    final tempDir = await getTemporaryDirectory();
    final savePath = '${tempDir.path}/Manar_Schedule_update.apk';
    final apkFile = File(savePath);

    if (await apkFile.exists()) {
      await apkFile.delete();
    }

    // 2. تنزيل الملف مع متابعة النسبة المئوية
    onStatusChange('جاري تنزيل التحديث داخل التطبيق...');
    final dio = Dio();
    await dio.download(
      url,
      savePath,
      onReceiveProgress: (received, total) {
        if (total > 0) {
          onProgress(received / total);
        } else if (expectedSizeBytes != null && expectedSizeBytes > 0) {
          onProgress(received / expectedSizeBytes);
        }
      },
    );

    // 3. التحقق من حجم الملف
    final downloadedBytes = await apkFile.length();
    if (expectedSizeBytes != null && expectedSizeBytes > 0 && downloadedBytes != expectedSizeBytes) {
      await apkFile.delete();
      throw Exception('حجم الملف المنزّل غير مكتمل. يرجى إعادة المحاولة.');
    }

    // 4. حساب والتحقق من SHA-256
    onStatusChange('جاري التحقق من سلامة التحديث (SHA-256)...');
    final bytes = await apkFile.readAsBytes();
    final computedHash = sha256.convert(bytes).toString().toUpperCase();

    if (expectedSha256 != null && expectedSha256.isNotEmpty) {
      if (computedHash != expectedSha256.toUpperCase()) {
        await apkFile.delete();
        throw Exception('تعذر التحقق من سلامة التحديث.');
      }
    }

    // 5. التحقق من إذن تثبيت الحزم على أندرويد
    onStatusChange('جاري فتح أداة التثبيت الرسمية...');
    if (Platform.isAndroid) {
      var status = await Permission.requestInstallPackages.status;
      if (!status.isGranted) {
        status = await Permission.requestInstallPackages.request();
        if (!status.isGranted) {
          onStatusChange('يرجى السماح بالتثبيت من هذا المصدر في إعدادات أندرويد.');
        }
      }
    }

    // 6. تشغيل أداة تثبيت حزم أندرويد الرسمية
    final result = await OpenFile.open(
      savePath,
      type: 'application/vnd.android.package-archive',
    );
    if (result.type != ResultType.done) {
      debugPrint('[VersionService] OpenFile status: ${result.message}');
    }
  }
}

/// حوار التحديث التفاعلي الزجاجي مع التنزيل الداخلي
class _UpdateDialogWidget extends StatefulWidget {
  final VersionCheckResult result;

  const _UpdateDialogWidget({required this.result});

  @override
  State<_UpdateDialogWidget> createState() => _UpdateDialogWidgetState();
}

class _UpdateDialogWidgetState extends State<_UpdateDialogWidget> {
  bool _isDownloading = false;
  double _progress = 0.0;
  String _statusMessage = '';
  String? _errorMessage;

  Future<void> _startDownload() async {
    setState(() {
      _isDownloading = true;
      _progress = 0.0;
      _errorMessage = null;
      _statusMessage = 'جاري التجهيز...';
    });

    try {
      await VersionService.downloadAndInstallApk(
        downloadUrl: widget.result.downloadUrl,
        expectedSizeBytes: widget.result.apkSizeBytes,
        expectedSha256: widget.result.apkHashSha256,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
        onStatusChange: (status) {
          if (mounted) setState(() => _statusMessage = status);
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _isDownloading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: GlassCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Icon
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: (widget.result.isMandatory ? AppColors.error : AppColors.accent).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    widget.result.isMandatory ? Icons.system_security_update_warning_rounded : Icons.system_update_rounded,
                    color: widget.result.isMandatory ? AppColors.error : AppColors.accent,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.result.isMandatory ? 'تحديث إجباري مطلوب' : 'تحديث جديد متوفر',
                        style: AppTextStyles.headlineSmall.copyWith(
                          color: widget.result.isMandatory ? AppColors.error : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'الإصدار v${widget.result.latestVersion} (Build ${widget.result.latestBuild})',
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.accent),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Message Body
            Text(
              widget.result.isMandatory
                  ? 'هذا الإصدار من تطبيق جداول المنار لم يعد مدعوماً. يرجى التحديث فوراً لمتابعة استخدام التطبيق والجداول الأكاديمية.'
                  : 'يتوفر إصدار رسمي جديد من التطبيق يتضمن تحسينات وميزات جديدة.',
              style: AppTextStyles.bodyMedium,
            ),

            if (widget.result.releaseNotes.isNotEmpty && !_isDownloading) ...[
              const SizedBox(height: 14),
              Text(
                'ما الجديد في هذا الإصدار:',
                style: AppTextStyles.labelLarge.copyWith(color: AppColors.accent),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: widget.result.releaseNotes
                      .map((note) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('• ', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
                                Expanded(child: Text(note, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary))),
                              ],
                            ),
                          ))
                      .toList(),
                ),
              ),
            ],

            // Progress Indicator
            if (_isDownloading) ...[
              const SizedBox(height: 20),
              LinearProgressIndicator(
                value: _progress > 0 ? _progress : null,
                backgroundColor: AppColors.darkCard,
                valueColor: const AlwaysStoppedAnimation(AppColors.accent),
                minHeight: 8,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      _statusMessage,
                      style: AppTextStyles.bodySmall.copyWith(color: AppColors.textPrimary),
                    ),
                  ),
                  Text(
                    '${(_progress * 100).toInt()}%',
                    style: AppTextStyles.labelSmall.copyWith(color: AppColors.accent, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],

            // Error Message Banner
            if (_errorMessage != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Buttons
            if (!_isDownloading)
              GradientButton(
                label: 'تحديث الآن',
                icon: Icons.download_rounded,
                onPressed: _startDownload,
              ),

            if (!widget.result.isMandatory && !_isDownloading) ...[
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  'لاحقاً',
                  style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textMuted),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
