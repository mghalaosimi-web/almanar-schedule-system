import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart';

/// شاشة إرسال إشعار بث للمجموعة (للمندوب فقط)
class BroadcastScreen extends StatefulWidget {
  const BroadcastScreen({super.key});

  @override
  State<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends State<BroadcastScreen> {
  final _ctrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _sending = false;
  bool _sent = false;

  // الإشعارات المُرسلة سابقاً (وهمية حالياً)
  final List<Map<String, String>> _history = [
    {'msg': 'تم تأجيل محاضرة الغد إلى قاعة 7', 'time': 'منذ ساعتين'},
    {'msg': 'تذكير: الاختبار النصفي الأسبوع القادم', 'time': 'أمس'},
  ];

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.campaign_rounded,
                color: AppColors.representativeColor, size: 22),
            const SizedBox(width: 10),
            Text(AppStrings.broadcastTitle, style: AppTextStyles.headlineSmall),
          ],
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Send Card ────────────────────────────────────────
            GlassCard(
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.representativeColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.send_rounded,
                              color: AppColors.representativeColor, size: 18),
                        ),
                        const SizedBox(width: 10),
                        Text('إشعار جديد', style: AppTextStyles.headlineSmall),
                      ],
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: _ctrl,
                      maxLines: 4,
                      maxLength: 300,
                      style: AppTextStyles.bodyLarge,
                      decoration: InputDecoration(
                        hintText: AppStrings.broadcastHint,
                        alignLabelWithHint: true,
                        counterStyle: AppTextStyles.bodySmall,
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) {
                          return 'أدخل نص الإشعار';
                        }
                        if (v.trim().length < 10) {
                          return 'النص قصير جداً (10 أحرف على الأقل)';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    _sent
                        ? Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.success.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                  color: AppColors.success.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_rounded,
                                    color: AppColors.success, size: 20),
                                const SizedBox(width: 8),
                                Text('تم إرسال الإشعار بنجاح!',
                                    style: AppTextStyles.labelLarge
                                        .copyWith(color: AppColors.success)),
                              ],
                            ),
                          ).animate().scale(duration: 400.ms).fadeIn()
                        : GradientButton(
                            label: AppStrings.sendBroadcast,
                            icon: Icons.send_rounded,
                            isLoading: _sending,
                            gradientColors: [
                              AppColors.representativeColor,
                              AppColors.warning,
                            ],
                            onPressed: _handleSend,
                          ),
                  ],
                ),
              ),
            ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2),

            const SizedBox(height: 24),

            // ── History ──────────────────────────────────────────
            if (_history.isNotEmpty) ...[
              Row(
                children: [
                  Container(
                    width: 3, height: 18,
                    decoration: BoxDecoration(
                      color: AppColors.representativeColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text('الإشعارات السابقة', style: AppTextStyles.headlineSmall),
                ],
              ),
              const SizedBox(height: 12),
              ..._history.asMap().entries.map((e) {
                final (msg, time) = (e.value['msg']!, e.value['time']!);
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.cardBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.notifications_rounded,
                          color: AppColors.representativeColor, size: 16),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(msg, style: AppTextStyles.bodyMedium
                                .copyWith(color: AppColors.textPrimary)),
                            const SizedBox(height: 4),
                            Text(time, style: AppTextStyles.bodySmall),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(delay: (e.key * 80).ms, duration: 300.ms)
                    .slideX(begin: 0.1, duration: 300.ms);
              }),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _handleSend() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _sending = true);
    HapticFeedback.mediumImpact();
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      setState(() {
        _sending = false;
        _sent = true;
        _history.insert(0, {'msg': _ctrl.text.trim(), 'time': 'الآن'});
        _ctrl.clear();
      });
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) setState(() => _sent = false);
      });
    }
  }
}
