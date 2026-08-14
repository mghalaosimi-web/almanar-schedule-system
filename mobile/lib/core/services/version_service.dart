import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
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
    required this.releaseNotes,
    required this.releaseDate,
  });
}

/// خدمة فحص ومقارنة إصدار التطبيق (Single Source of Truth)
class VersionService {
  static const String currentVersionName = '2.0.0';
  static const int currentBuildNumber = 2;

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
}

/// حوار التحديث التفاعلي الزجاجي
class _UpdateDialogWidget extends StatelessWidget {
  final VersionCheckResult result;

  const _UpdateDialogWidget({required this.result});

  Future<void> _launchDownload() async {
    String url = result.downloadUrl;
    if (!url.startsWith('http')) {
      final base = ApiEndpoints.baseUrl.replaceAll('/api', '');
      url = '$base$url';
    }

    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
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
                    color: (result.isMandatory ? AppColors.error : AppColors.accent).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    result.isMandatory ? Icons.system_security_update_warning_rounded : Icons.system_update_rounded,
                    color: result.isMandatory ? AppColors.error : AppColors.accent,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        result.isMandatory ? 'تحديث إجباري مطلوب' : 'تحديث جديد متوفر',
                        style: AppTextStyles.headlineSmall.copyWith(
                          color: result.isMandatory ? AppColors.error : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'الإصدار الجديد v${result.latestVersion} (Build ${result.latestBuild})',
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
              result.isMandatory
                  ? 'هذا الإصدار من تطبيق جداول المنار لم يعد مدعوماً. يرجى التحديث فوراً لمتابعة استخدام التطبيق والجداول الأكاديمية.'
                  : 'يتوفر إصدار رسمي جديد من التطبيق يتضمن تحسينات وميزات جديدة.',
              style: AppTextStyles.bodyMedium,
            ),

            if (result.releaseNotes.isNotEmpty) ...[
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
                  children: result.releaseNotes
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

            const SizedBox(height: 24),

            // Buttons
            GradientButton(
              label: 'تحديث الآن',
              icon: Icons.download_rounded,
              onPressed: _launchDownload,
            ),

            if (!result.isMandatory) ...[
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
