import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../utils/connectivity_service.dart';
import '../constants/app_strings.dart';

/// شارة حالة الاتصال — تظهر تلقائياً عند الأوف لاين
class ConnectionStatusBadge extends StatelessWidget {
  const ConnectionStatusBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ConnectivityService>(
      builder: (context, connectivity, _) {
        if (connectivity.isConnected) return const SizedBox.shrink();

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: AppColors.warning.withOpacity(0.15),
          child: Row(
            children: [
              const Icon(Icons.wifi_off_rounded, color: AppColors.warning, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  AppStrings.offline,
                  style: AppTextStyles.bodySmall.copyWith(color: AppColors.warning),
                ),
              ),
            ],
          ),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .fadeIn(duration: 400.ms)
            .then()
            .shimmer(duration: 2000.ms, color: AppColors.warning.withOpacity(0.2));
      },
    );
  }
}

/// شارة صغيرة مخصصة (للاستخدام في بطاقات الجدول)
class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;
  final bool pulse;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.pulse = false,
  });

  factory StatusBadge.override() => const StatusBadge(
        label: 'تعديل استثنائي',
        color: AppColors.warning,
        icon: Icons.info_outline_rounded,
        pulse: true,
      );

  factory StatusBadge.offline() => const StatusBadge(
        label: 'محفوظ محلياً',
        color: AppColors.offline,
        icon: Icons.cloud_off_rounded,
      );

  factory StatusBadge.live() => const StatusBadge(
        label: 'مباشر',
        color: AppColors.success,
        icon: Icons.circle,
        pulse: true,
      );

  @override
  Widget build(BuildContext context) {
    Widget badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: color, size: 11),
            const SizedBox(width: 4),
          ],
          Text(label, style: AppTextStyles.labelSmall.copyWith(color: color)),
        ],
      ),
    );

    if (pulse) {
      badge = badge
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .fadeIn(duration: 300.ms)
          .then()
          .scale(end: const Offset(1.02, 1.02), duration: 800.ms);
    }

    return badge;
  }
}
