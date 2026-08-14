import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/status_badge.dart';
import '../models/schedule_entry.dart';

/// بطاقة حصة دراسية واحدة بتصميم زجاجي
class ScheduleCard extends StatelessWidget {
  final ScheduleEntry entry;
  final int index;

  const ScheduleCard({
    super.key,
    required this.entry,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: entry.isOverridden
              ? AppColors.warning.withOpacity(0.4)
              : AppColors.glassBorder,
          width: entry.isOverridden ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: entry.isOverridden
                ? AppColors.warning.withOpacity(0.06)
                : AppColors.accent.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Row 1: Code + Time ─────────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _CodeBadge(code: entry.subjectCode),
                _TimeBadge(time: entry.displayTime),
              ],
            ),
            const SizedBox(height: 12),

            // ── Subject Name ───────────────────────────────────
            Text(
              entry.subject,
              style: AppTextStyles.headlineSmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),

            // ── Row 2: Lecturer + Room ─────────────────────────
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(Icons.person_outline_rounded,
                          color: AppColors.textMuted, size: 14),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          entry.lecturer,
                          style: AppTextStyles.bodySmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Row(
                  children: [
                    const Icon(Icons.meeting_room_outlined,
                        color: AppColors.accent, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      entry.room,
                      style: AppTextStyles.accentLabel,
                    ),
                  ],
                ),
              ],
            ),

            // ── Override Notice ────────────────────────────────
            if (entry.isOverridden) ...[
              const SizedBox(height: 10),
              const Divider(height: 1, color: AppColors.glassBorder),
              const SizedBox(height: 10),
              Row(
                children: [
                  StatusBadge.override(),
                  if (entry.overrideNote != null && entry.overrideNote!.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        entry.overrideNote!,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: AppColors.warning.withOpacity(0.8),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: (index * 60).ms, duration: 400.ms)
        .slideY(begin: 0.2, duration: 350.ms, curve: Curves.easeOut);
  }
}

// ── Sub-widgets ────────────────────────────────────────────────────

class _CodeBadge extends StatelessWidget {
  final String code;
  const _CodeBadge({required this.code});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.accentSubtle,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.accent.withOpacity(0.25)),
      ),
      child: Text(code, style: AppTextStyles.accentLabel.copyWith(fontSize: 11)),
    );
  }
}

class _TimeBadge extends StatelessWidget {
  final String time;
  const _TimeBadge({required this.time});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.access_time_rounded,
            color: AppColors.textMuted, size: 14),
        const SizedBox(width: 4),
        Text(time,
            style: AppTextStyles.labelMedium.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
                fontSize: 12)),
      ],
    );
  }
}
