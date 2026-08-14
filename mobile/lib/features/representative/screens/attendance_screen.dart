import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/gradient_button.dart';

/// شاشة تسجيل الحضور للمندوب
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  // بيانات وهمية — ستُحل بالـ API لاحقاً
  final List<_Student> _students = List.generate(
    12,
    (i) => _Student(
      id: '2026-${(1000 + i).toString()}',
      name: _sampleNames[i % _sampleNames.length],
      status: AttendanceStatus.absent,
    ),
  );

  bool _isSubmitting = false;
  bool _submitted = false;

  static const _sampleNames = [
    'أحمد محمد الزيدي', 'فاطمة علي الحمود', 'خالد عبدالله الغامدي',
    'سارة يوسف النجار', 'عمر حسن الزهراني', 'نورة سعد القحطاني',
    'مصطفى إبراهيم العمري', 'هند طارق البكري', 'يوسف محمود الشمري',
    'ليلى أحمد الحارثي', 'عبدالرحمن وليد السهلي', 'منى كريم الدوسري',
  ];

  int get _presentCount => _students.where((s) => s.status == AttendanceStatus.present).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.how_to_reg_rounded, color: AppColors.representativeColor, size: 22),
            const SizedBox(width: 10),
            Text(AppStrings.attendance, style: AppTextStyles.headlineSmall),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.representativeColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.representativeColor.withOpacity(0.3)),
                ),
                child: Text(
                  '$_presentCount / ${_students.length}',
                  style: AppTextStyles.labelLarge.copyWith(
                      color: AppColors.representativeColor),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Progress Bar ─────────────────────────────────────
          _buildProgressBar(),

          // ── Student List ──────────────────────────────────────
          Expanded(
            child: _submitted ? _buildSuccessState() : _buildStudentList(),
          ),

          // ── Submit Button ─────────────────────────────────────
          if (!_submitted)
            Padding(
              padding: const EdgeInsets.all(16),
              child: GradientButton(
                label: AppStrings.submitAttendance,
                icon: Icons.upload_rounded,
                isLoading: _isSubmitting,
                gradientColors: [
                  AppColors.representativeColor,
                  AppColors.warning,
                ],
                onPressed: _submit,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    final ratio = _students.isEmpty ? 0.0 : _presentCount / _students.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('نسبة الحضور', style: AppTextStyles.bodySmall),
              Text('${(ratio * 100).toStringAsFixed(0)}%',
                  style: AppTextStyles.accentLabel.copyWith(
                      color: AppColors.representativeColor)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: ratio,
              backgroundColor: AppColors.glassBorder,
              valueColor: const AlwaysStoppedAnimation(AppColors.representativeColor),
              minHeight: 8,
            ),
          ).animate().slideX(begin: -1, duration: 600.ms, curve: Curves.easeOut),
        ],
      ),
    );
  }

  Widget _buildStudentList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _students.length,
      itemBuilder: (_, i) {
        final s = _students[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: s.status == AttendanceStatus.present
                  ? AppColors.success.withOpacity(0.4)
                  : AppColors.glassBorder,
            ),
          ),
          child: Row(
            children: [
              // ── Name ─────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.name, style: AppTextStyles.labelLarge),
                    Text(s.id, style: AppTextStyles.bodySmall),
                  ],
                ),
              ),
              // ── Toggle ───────────────────────────────────────
              Row(
                children: [
                  _StatusButton(
                    label: 'غائب',
                    isSelected: s.status == AttendanceStatus.absent,
                    color: AppColors.error,
                    onTap: () {
                      setState(() => _students[i].status = AttendanceStatus.absent);
                      HapticFeedback.selectionClick();
                    },
                  ),
                  const SizedBox(width: 8),
                  _StatusButton(
                    label: 'حاضر',
                    isSelected: s.status == AttendanceStatus.present,
                    color: AppColors.success,
                    onTap: () {
                      setState(() => _students[i].status = AttendanceStatus.present);
                      HapticFeedback.selectionClick();
                    },
                  ),
                ],
              ),
            ],
          ),
        )
            .animate()
            .fadeIn(delay: (i * 40).ms, duration: 300.ms)
            .slideX(begin: 0.1, duration: 300.ms);
      },
    );
  }

  Widget _buildSuccessState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.success.withOpacity(0.15),
            ),
            child: const Icon(Icons.check_circle_rounded,
                color: AppColors.success, size: 48),
          ).animate().scale(duration: 500.ms, curve: Curves.elasticOut),
          const SizedBox(height: 16),
          Text('تم رفع كشف الحضور!', style: AppTextStyles.headlineMedium),
          const SizedBox(height: 8),
          Text('حضر $_presentCount من ${_students.length} طالب',
              style: AppTextStyles.bodyMedium),
        ],
      ).animate().fadeIn(delay: 200.ms),
    );
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    // محاكاة إرسال
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() { _isSubmitting = false; _submitted = true; });
  }
}

// ── Helper Types ────────────────────────────────────────────────────

enum AttendanceStatus { present, absent }

class _Student {
  final String id;
  final String name;
  AttendanceStatus status;
  _Student({required this.id, required this.name, required this.status});
}

class _StatusButton extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  const _StatusButton({
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: isSelected ? color : AppColors.glassBorder),
        ),
        child: Text(label,
            style: AppTextStyles.labelSmall.copyWith(
              color: isSelected ? color : AppColors.textMuted,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
            )),
      ),
    );
  }
}
