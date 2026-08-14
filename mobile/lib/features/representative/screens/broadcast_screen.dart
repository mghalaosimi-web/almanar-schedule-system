import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/services/notification_service.dart';

/// شاشة إرسال إشعار بث للمجموعة — متصلة بالـ Backend
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
  bool _isLoadingHistory = true;
  String? _errorMessage;

  final List<Map<String, String>> _history = [];

  @override
  void initState() {
    super.initState();
    _fetchBroadcastHistory();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _fetchBroadcastHistory() async {
    setState(() {
      _isLoadingHistory = true;
      _errorMessage = null;
    });

    try {
      final api = ApiClient();
      final response = await api.get(ApiEndpoints.broadcasts);

      if (response.data != null && response.data['success'] == true) {
        final List rawList = response.data['data'] as List? ?? [];
        final parsed = rawList.map((item) {
          final map = item as Map<String, dynamic>;
          final msg = map['message'] as String? ?? '';
          final rawTime = map['sentTime'] as String?;
          String formattedTime = 'سابقاً';
          if (rawTime != null) {
            try {
              final dt = DateTime.parse(rawTime);
              formattedTime = DateFormat('yyyy/MM/dd – HH:mm').format(dt);
            } catch (_) {
              formattedTime = rawTime;
            }
          }
          return {'msg': msg, 'time': formattedTime};
        }).toList();

        if (mounted) {
          setState(() {
            _history.clear();
            _history.addAll(parsed);
            _isLoadingHistory = false;
          });
        }
        return;
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingHistory = false;
          if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
            _errorMessage = 'غير مصرح: صُنعت هذه الشاشة لمندوبي الدفعات المعينين.';
          } else {
            _errorMessage = 'تعذر تحميل سجل الإشعارات السابق.';
          }
        });
      }
      return;
    } catch (e) {
      debugPrint('[BroadcastScreen] Fetch history error: $e');
    }

    if (mounted) {
      setState(() => _isLoadingHistory = false);
    }
  }

  Future<void> _handleSend() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _sending = true;
      _errorMessage = null;
    });
    HapticFeedback.mediumImpact();

    final messageText = _ctrl.text.trim();

    try {
      final api = ApiClient();
      final response = await api.post(
        ApiEndpoints.broadcast,
        data: {'message': messageText},
      );

      if (response.data != null &&
          (response.data['success'] == true || response.statusCode == 201)) {
        await LocalNotificationService().notifyBroadcastReceived(
          mandoobName: 'مندوب الشعبة',
          message: messageText,
        );

        if (mounted) {
          setState(() {
            _sending = false;
            _sent = true;
            _history.insert(0, {
              'msg': messageText,
              'time': 'الآن',
            });
            _ctrl.clear();
          });

          Future.delayed(const Duration(seconds: 3), () {
            if (mounted) setState(() => _sent = false);
          });
        }
        return;
      }
    } on DioException catch (e) {
      final serverMsg = e.response?.data?['error'] as String? ?? 'فشل إرسال البث الجماعي.';
      if (mounted) {
        setState(() {
          _sending = false;
          _errorMessage = serverMsg;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(serverMsg, style: AppTextStyles.bodyMedium.copyWith(color: Colors.white)),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    } catch (e) {
      debugPrint('[BroadcastScreen] Send error: $e');
    }

    if (mounted) {
      setState(() => _sending = false);
    }
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
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.accent),
            onPressed: _fetchBroadcastHistory,
            tooltip: 'تحديث السجل',
          ),
          const SizedBox(width: 8),
        ],
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
                        Text('إشعار جديد للمجموعة', style: AppTextStyles.headlineSmall),
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
                        if (v.trim().length < 5) {
                          return 'النص قصير جداً (5 أحرف على الأقل)';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    if (_errorMessage != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _errorMessage!,
                          style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
                        ),
                      ),

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
                                Text('تم إرسال الإشعار لجميع طلاب الدفعة بنجاح!',
                                    style: AppTextStyles.labelLarge
                                        .copyWith(color: AppColors.success)),
                              ],
                            ),
                          ).animate().scale(duration: 400.ms).fadeIn()
                        : GradientButton(
                            label: AppStrings.sendBroadcast,
                            icon: Icons.send_rounded,
                            isLoading: _sending,
                            gradientColors: const [
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

            // ── History Header ────────────────────────────────────
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
                Text('الإشعارات السابقة المرسلة', style: AppTextStyles.headlineSmall),
                const Spacer(),
                if (_isLoadingHistory)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.representativeColor),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // ── History List ─────────────────────────────────────
            if (_isLoadingHistory && _history.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('جاري تحميل سجل البث...', style: AppTextStyles.bodyMedium),
                ),
              ),

            if (!_isLoadingHistory && _history.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text('لم تقم بإرسال أي إشعار سابق لهذه المجموعة.', style: AppTextStyles.bodyMedium),
                ),
              ),

            if (_history.isNotEmpty)
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
        ),
      ),
    );
  }
}
