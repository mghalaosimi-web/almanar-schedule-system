import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';

/// شريط اختيار أيام الأسبوع الأفقي
class DaySelector extends StatelessWidget {
  final String selectedDay;
  final ValueChanged<String> onDaySelected;

  static const _days = [
    ('SATURDAY',  'السبت'),
    ('SUNDAY',    'الأحد'),
    ('MONDAY',    'الاثنين'),
    ('TUESDAY',   'الثلاثاء'),
    ('WEDNESDAY', 'الأربعاء'),
    ('THURSDAY',  'الخميس'),
  ];

  const DaySelector({
    super.key,
    required this.selectedDay,
    required this.onDaySelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 58,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        itemCount: _days.length,
        itemBuilder: (context, i) {
          final (key, label) = _days[i];
          final isSelected = key == selectedDay;

          return GestureDetector(
            onTap: () => onDaySelected(key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                gradient: isSelected ? AppColors.accentGradient : null,
                color: isSelected ? null : AppColors.cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected
                      ? AppColors.accent.withOpacity(0.6)
                      : AppColors.glassBorder,
                ),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: AppColors.accent.withOpacity(0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        )
                      ]
                    : [],
              ),
              child: Center(
                child: Text(
                  label,
                  style: AppTextStyles.labelMedium.copyWith(
                    color: isSelected ? Colors.black : AppColors.textSecondary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          )
              .animate(key: ValueKey('day_$key'))
              .fadeIn(delay: (50 * i).ms, duration: 300.ms)
              .slideX(begin: 0.2, duration: 300.ms, curve: Curves.easeOut);
        },
      ),
    );
  }
}
