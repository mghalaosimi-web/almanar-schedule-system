import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/services/notification_service.dart';

class OverrideRequestScreen extends StatefulWidget {
  const OverrideRequestScreen({super.key});

  @override
  State<OverrideRequestScreen> createState() => _OverrideRequestScreenState();
}

class _OverrideRequestScreenState extends State<OverrideRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCtrl = TextEditingController();
  final _newRoomCtrl = TextEditingController();
  final _newTimeCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  String _selectedDay = 'SUNDAY';
  String _requestType = 'تعديل قاعة';
  bool _isSubmitting = false;

  static const _days = [
    ('SATURDAY', 'السبت'),
    ('SUNDAY', 'الأحد'),
    ('MONDAY', 'الاثنين'),
    ('TUESDAY', 'الثلاثاء'),
    ('WEDNESDAY', 'الأربعاء'),
    ('THURSDAY', 'الخميس'),
  ];

  static const _types = [
    'تعديل قاعة',
    'تأجيل موعد محاضرة',
    'تقديم موعد محاضرة',
    'محاضرة تعويضية',
  ];

  final List<Map<String, dynamic>> _myRequests = [
    {
      'subject': 'هندسة البرمجيات 2',
      'type': 'تعديل قاعة',
      'details': 'نقل إلى معمل البرمجة (08:00 - 10:00)',
      'status': 'موافق عليه',
      'statusColor': AppColors.success,
      'date': 'اليوم',
    },
    {
      'subject': 'قواعد البيانات المتقدمة',
      'type': 'تأجيل موعد',
      'details': 'تأجيل إلى الساعة 11:00 AM',
      'status': 'قيد النظر',
      'statusColor': AppColors.gold,
      'date': 'أمس',
    },
  ];

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _newRoomCtrl.dispose();
    _newTimeCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitOverrideRequest() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _isSubmitting = true);
    HapticFeedback.lightImpact();

    try {
      final api = ApiClient();
      await api.post(
        ApiEndpoints.overrideRequest,
        data: {
          'subject': _subjectCtrl.text.trim(),
          'day': _selectedDay,
          'type': _requestType,
          'newRoom': _newRoomCtrl.text.trim(),
          'newTime': _newTimeCtrl.text.trim(),
          'reason': _reasonCtrl.text.trim(),
        },
      );
    } catch (_) {
      // Graceful offline fallback
    }

    if (!mounted) return;

    setState(() {
      _isSubmitting = false;
      _myRequests.insert(0, {
        'subject': _subjectCtrl.text.trim(),
        'type': _requestType,
        'details': 'قاعة: ${_newRoomCtrl.text.trim()} (${_newTimeCtrl.text.trim()})',
        'status': 'قيد النظر',
        'statusColor': AppColors.gold,
        'date': 'الآن',
      });
    });

    // Send local notification alert
    await LocalNotificationService().showNotification(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: '📝 تم تقديم طلب التعديل',
      body: 'طلب تعديل مادة ${_subjectCtrl.text.trim()} قيد مراجعة العمادة.',
    );

    _subjectCtrl.clear();
    _newRoomCtrl.clear();
    _newTimeCtrl.clear();
    _reasonCtrl.clear();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'تم رفع طلب التعديل الاستثنائي إلى قسم الشؤون الأكاديمية بنجاح ✓',
          style: AppTextStyles.bodyMedium.copyWith(color: Colors.white),
        ),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.edit_calendar_rounded, color: AppColors.gold, size: 22),
            const SizedBox(width: 10),
            Text('طلب تعديل جدول (خاص بالمندوب)', style: AppTextStyles.headlineSmall),
          ],
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Form Card ──────────────────────────────────────────
            GlassCardAccent(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('تقديم طلب تعديل مؤقت', style: AppTextStyles.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      'يتطلب موافقة قسم المحاضرين قبل تعميمه على كشف المجموعة',
                      style: AppTextStyles.bodySmall,
                    ),
                    const SizedBox(height: 16),

                    // Subject Name
                    TextFormField(
                      controller: _subjectCtrl,
                      style: AppTextStyles.inputText,
                      decoration: const InputDecoration(
                        labelText: 'اسم المادة',
                        hintText: 'هندسة البرمجيات 2',
                        prefixIcon: Icon(Icons.menu_book_rounded, color: AppColors.accent, size: 20),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل اسم المادة' : null,
                    ),
                    const SizedBox(height: 12),

                    // Day & Type Row
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _selectedDay,
                            dropdownColor: AppColors.cardBg,
                            style: AppTextStyles.inputText,
                            decoration: const InputDecoration(labelText: 'اليوم'),
                            items: _days.map((d) => DropdownMenuItem(value: d.$1, child: Text(d.$2))).toList(),
                            onChanged: (v) => setState(() => _selectedDay = v!),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _requestType,
                            dropdownColor: AppColors.cardBg,
                            style: AppTextStyles.inputText,
                            decoration: const InputDecoration(labelText: 'نوع التعديل'),
                            items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                            onChanged: (v) => setState(() => _requestType = v!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Room & Time Row
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _newRoomCtrl,
                            style: AppTextStyles.inputText,
                            decoration: const InputDecoration(
                              labelText: 'القاعة المقترحة',
                              hintText: 'قاعة 102',
                              prefixIcon: Icon(Icons.meeting_room_rounded, color: AppColors.accent, size: 20),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل القاعة' : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextFormField(
                            controller: _newTimeCtrl,
                            style: AppTextStyles.inputText,
                            decoration: const InputDecoration(
                              labelText: 'الموعد المقترح',
                              hintText: '10:00 - 12:00',
                              prefixIcon: Icon(Icons.access_time_rounded, color: AppColors.accent, size: 20),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'أدخل الموعد' : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Reason Textarea
                    TextFormField(
                      controller: _reasonCtrl,
                      maxLines: 2,
                      style: AppTextStyles.inputText,
                      decoration: const InputDecoration(
                        labelText: 'سبب التعديل الاستثنائي',
                        hintText: 'بسبب انشغال المعمل الرئيسي في هذا التوقيت...',
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'اذكر السبب' : null,
                    ),
                    const SizedBox(height: 20),

                    // Submit Button
                    GradientButton(
                      label: 'رفع طلب التعديل',
                      icon: Icons.send_rounded,
                      isLoading: _isSubmitting,
                      onPressed: _submitOverrideRequest,
                    ),
                  ],
                ),
              ),
            ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2),

            const SizedBox(height: 28),

            // ── Submitted Requests History ─────────────────────────
            Row(
              children: [
                Container(width: 3, height: 18, color: AppColors.gold),
                const SizedBox(width: 10),
                Text('طلباتي السابقة', style: AppTextStyles.headlineSmall),
              ],
            ),
            const SizedBox(height: 12),

            ..._myRequests.asMap().entries.map((e) {
              final req = e.value;
              final Color statusColor = req['statusColor'] as Color;

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(req['subject'] as String, style: AppTextStyles.labelLarge),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.accentSubtle,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(req['type'] as String, style: AppTextStyles.accentLabel.copyWith(fontSize: 10)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(req['details'] as String, style: AppTextStyles.bodyMedium),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        req['status'] as String,
                        style: AppTextStyles.labelSmall.copyWith(color: statusColor, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: (e.key * 80).ms, duration: 300.ms);
            }),
          ],
        ),
      ),
    );
  }
}
