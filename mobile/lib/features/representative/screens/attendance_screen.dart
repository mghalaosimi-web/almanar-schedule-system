import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:dio/dio.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/gradient_button.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/services/notification_service.dart';

/// شاشة تسجيل الحضور للمندوب — متصلة بالـ Backend
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<_Student> _students = [];
  bool _isLoadingStudents = true;
  String? _errorMessage;
  bool _isSubmitting = false;
  bool _submitted = false;

  int get _presentCount => _students.where((s) => s.status == AttendanceStatus.present).length;

  @override
  void initState() {
    super.initState();
    _fetchClassmates();
  }

  Future<void> _fetchClassmates() async {
    setState(() {
      _isLoadingStudents = true;
      _errorMessage = null;
    });

    try {
      final api = ApiClient();
      final response = await api.get(ApiEndpoints.classmates);

      if (response.data != null && response.data['success'] == true) {
        final List rawList = response.data['data'] as List? ?? [];
        final parsed = rawList.map((item) {
          final map = item as Map<String, dynamic>;
          return _Student(
            id: map['id']?.toString() ?? '',
            idNumber: map['idNumber'] as String? ?? map['studentId'] as String? ?? '—',
            name: map['name'] as String? ?? 'طالب غير مسمى',
            status: AttendanceStatus.absent,
          );
        }).toList();

        if (mounted) {
          setState(() {
            _students = parsed;
            _isLoadingStudents = false;
            if (_students.isEmpty) {
              _errorMessage = 'لا يوجد طلاب مسجلون في هذه المجموعة حالياً.';
            }
          });
        }
        return;
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingStudents = false;
          if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
            _errorMessage = 'غير مصرح: خيارات الحضور مقتصرة على مندوبي الشعبة المعينين.';
          } else {
            _errorMessage = 'تعذر تحميل قائمة الطلاب. تحقق من الاتصال بالشبكة.';
          }
        });
      }
      return;
    } catch (e) {
      debugPrint('[AttendanceScreen] Fetch error: $e');
    }

    if (mounted) {
      setState(() {
        _isLoadingStudents = false;
        _errorMessage = 'حدث خطأ في تحميل كشف الطلاب.';
      });
    }
  }

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
          if (!_isLoadingStudents && _students.isNotEmpty)
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
                      color: AppColors.representativeColor,
                    ),
                  ),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.accent),
            onPressed: _fetchClassmates,
            tooltip: 'تحديث القائمة',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // ── Progress Bar ─────────────────────────────────────
          if (!_isLoadingStudents && _students.isNotEmpty) _buildProgressBar(),

          // ── Student List Body ─────────────────────────────────
          Expanded(
            child: _buildBody(),
          ),

          // ── Submit Button ─────────────────────────────────────
          if (!_submitted && !_isLoadingStudents && _students.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: GradientButton(
                label: AppStrings.submitAttendance,
                icon: Icons.upload_rounded,
                isLoading: _isSubmitting,
                gradientColors: const [
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
              Text('نسبة الحضور الحالية', style: AppTextStyles.bodySmall),
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

  Widget _buildBody() {
    if (_isLoadingStudents) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: AppColors.representativeColor),
            const SizedBox(height: 16),
            Text('جاري تحميل طلاب الشعبة...', style: AppTextStyles.bodyMedium),
          ],
        ),
      );
    }

    if (_errorMessage != null && _students.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 48),
              const SizedBox(height: 16),
              Text(_errorMessage!, style: AppTextStyles.bodyMedium, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _fetchClassmates,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
    }

    if (_submitted) {
      return _buildSuccessState();
    }

    return _buildStudentList();
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
                    Text('الرقم: ${s.idNumber}', style: AppTextStyles.bodySmall),
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
          Text('تم رفع كشف الحضور بنجاح!', style: AppTextStyles.headlineMedium),
          const SizedBox(height: 8),
          Text('حضر $_presentCount من ${_students.length} طالب',
              style: AppTextStyles.bodyMedium),
        ],
      ).animate().fadeIn(delay: 200.ms),
    );
  }

  Future<void> _submit() async {
    if (_students.isEmpty) return;

    setState(() => _isSubmitting = true);
    HapticFeedback.mediumImpact();

    try {
      final api = ApiClient();
      final recordsPayload = _students.map((s) => {
        'studentId': s.id,
        'status': s.status == AttendanceStatus.present ? 'PRESENT' : 'ABSENT',
      }).toList();

      final response = await api.post(
        ApiEndpoints.attendance,
        data: {
          'scheduleId': 1,
          'date': DateTime.now().toIso8601String(),
          'records': recordsPayload,
        },
      );

      if (response.data != null && response.data['success'] == true) {
        await LocalNotificationService().showNotification(
          id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title: '📋 تم رفع كشف الحضور',
          body: 'تم تسجيل حضور $_presentCount طالب في السيرفر بنجاح ✓',
        );

        if (mounted) {
          setState(() {
            _isSubmitting = false;
            _submitted = true;
          });
        }
        return;
      }
    } on DioException catch (e) {
      debugPrint('[AttendanceScreen] Submit Dio error: ${e.message}');
      final msg = e.response?.data?['error'] as String? ?? 'تعذر حفظ الحضور في السيرفر.';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg, style: AppTextStyles.bodyMedium.copyWith(color: Colors.white)),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } catch (e) {
      debugPrint('[AttendanceScreen] Unexpected submit error: $e');
    }

    if (mounted) {
      setState(() => _isSubmitting = false);
    }
  }
}

// ── Helper Types ────────────────────────────────────────────────────

enum AttendanceStatus { present, absent }

class _Student {
  final String id;
  final String idNumber;
  final String name;
  AttendanceStatus status;
  _Student({
    required this.id,
    required this.idNumber,
    required this.name,
    required this.status,
  });
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
