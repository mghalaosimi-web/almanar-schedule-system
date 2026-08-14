import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';

/// شاشة طلب الانضمام والتسجيل — متصلة بالـ Backend
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _studentIdCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  String _selectedMajor = 'هندسة البرمجيات';
  String _selectedLevel = '1';
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  static const _majors = [
    'هندسة البرمجيات',
    'الأمن السيبراني',
    'تقنية المعلومات',
    'إدارة الأعمال',
    'المحاسبة',
    'الشريعة والقانون',
  ];

  static const _levels = ['1', '2', '3', '4'];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _studentIdCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    HapticFeedback.lightImpact();

    try {
      final api = ApiClient();
      final response = await api.post(
        ApiEndpoints.register,
        data: {
          'fullName': _nameCtrl.text.trim(),
          'email': _emailCtrl.text.trim(),
          'password': _passwordCtrl.text.trim(),
          'phone': _phoneCtrl.text.trim(),
          'idNumber': _studentIdCtrl.text.trim(),
          'majorId': _selectedMajor,
          'levelId': _selectedLevel,
          'collegeId': 1,
        },
      );

      final data = response.data as Map<String, dynamic>?;
      if (data != null && (data['success'] == true || response.statusCode == 201)) {
        final token = data['token'] as String?;
        if (token != null) {
          await api.saveToken(token);
        }

        if (!mounted) return;
        setState(() => _isLoading = false);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'تم تقديم طلب التسجيل وإنشاء الحساب بنجاح! ✓',
              style: AppTextStyles.bodyMedium.copyWith(color: Colors.white),
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
          ),
        );

        context.go('/login');
        return;
      }
    } on DioException catch (e) {
      final serverMsg = e.response?.data?['error'] as String? ??
          e.response?.data?['message'] as String? ??
          'تعذر إكمال طلب التسجيل. تحقق من البيانات والشبكة.';
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = serverMsg;
        });
      }
      return;
    } catch (e) {
      debugPrint('[RegisterScreen] Unexpected error: $e');
    }

    if (mounted) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'حدث خطأ غير متوقع أثناء إرسال البيانات.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary),
          onPressed: () => context.go('/login'),
        ),
        title: Text('طلب الانضمام والتسجيل', style: AppTextStyles.headlineSmall),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            children: [
              // Header Card
              GlassCardAccent(
                child: Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.accentSubtle,
                        border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                      ),
                      child: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.accent, size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('انضم لكلية المنار', style: AppTextStyles.headlineSmall),
                          const SizedBox(height: 4),
                          Text(
                            'سجّل حسابك الجديد للدخول التلقائي للجداول',
                            style: AppTextStyles.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2),

              const SizedBox(height: 20),

              // Register Form Card
              GlassCard(
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Full Name
                      TextFormField(
                        controller: _nameCtrl,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'الاسم الثلاثي أو الرباعي',
                          hintText: 'أحمد محمد علي الزيدي',
                          prefixIcon: Icon(Icons.person_outline_rounded, color: AppColors.accent, size: 20),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'أدخل الاسم الكامل';
                          final parts = v.trim().split(RegExp(r'\s+'));
                          if (parts.length < 3) return 'يجب إدخال الاسم الثلاثي على الأقل';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),

                      // Email
                      TextFormField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'البريد الإلكتروني',
                          hintText: 'student@almanar.edu.ye',
                          prefixIcon: Icon(Icons.email_outlined, color: AppColors.accent, size: 20),
                        ),
                        validator: (v) => (v == null || !v.contains('@')) ? 'أدخل بريد إلكتروني صحيح' : null,
                      ),
                      const SizedBox(height: 14),

                      // Student ID (Optional)
                      TextFormField(
                        controller: _studentIdCtrl,
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'رقم الطالب الجامعي (إن وجد)',
                          hintText: '2026-TEST01',
                          prefixIcon: Icon(Icons.badge_outlined, color: AppColors.gold, size: 20),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Major Selector Dropdown
                      DropdownButtonFormField<String>(
                        value: _selectedMajor,
                        dropdownColor: AppColors.cardBg,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'التخصص الاكاديمي',
                          prefixIcon: Icon(Icons.school_outlined, color: AppColors.accent, size: 20),
                        ),
                        items: _majors.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                        onChanged: (v) => setState(() => _selectedMajor = v!),
                      ),
                      const SizedBox(height: 14),

                      // Level Selector
                      DropdownButtonFormField<String>(
                        value: _selectedLevel,
                        dropdownColor: AppColors.cardBg,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'المستوى الدراسي',
                          prefixIcon: Icon(Icons.stairs_outlined, color: AppColors.accent, size: 20),
                        ),
                        items: _levels.map((l) => DropdownMenuItem(value: l, child: Text('المستوى $l'))).toList(),
                        onChanged: (v) => setState(() => _selectedLevel = v!),
                      ),
                      const SizedBox(height: 14),

                      // Phone Number
                      TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.inputText,
                        decoration: const InputDecoration(
                          labelText: 'رقم الهاتف / الواتساب',
                          hintText: '+967 770 000 000',
                          prefixIcon: Icon(Icons.phone_android_outlined, color: AppColors.accent, size: 20),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'أدخل رقم الهاتف';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),

                      // Password
                      TextFormField(
                        controller: _passwordCtrl,
                        obscureText: _obscurePassword,
                        textDirection: TextDirection.ltr,
                        style: AppTextStyles.inputText,
                        decoration: InputDecoration(
                          labelText: AppStrings.password,
                          hintText: '••••••••',
                          prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.accent, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: AppColors.textMuted,
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                        ),
                        validator: (v) => (v == null || v.length < 6) ? 'كلمة المرور 6 أحرف على الأقل' : null,
                      ),
                      const SizedBox(height: 16),

                      if (_errorMessage != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: AppColors.error.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.error.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(_errorMessage!, style: AppTextStyles.bodySmall.copyWith(color: AppColors.error)),
                              ),
                            ],
                          ),
                        ),

                      // Submit Button
                      GradientButton(
                        label: 'إرسال طلب التسجيل',
                        icon: Icons.check_circle_rounded,
                        isLoading: _isLoading,
                        onPressed: _handleRegister,
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 200.ms, duration: 400.ms),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
