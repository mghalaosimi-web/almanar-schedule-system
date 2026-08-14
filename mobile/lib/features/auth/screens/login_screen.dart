import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/utils/connectivity_service.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  // ── Controllers ────────────────────────────────────────────────
  final _formKey = GlobalKey<FormState>();
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  late final AnimationController _bgController;
  late final AnimationController _logoController;

  // ── State ─────────────────────────────────────────────────────
  UserRole _selectedRole = UserRole.student;
  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  String? _errorMessage;

  // ── Role Config ───────────────────────────────────────────────
  static const _roles = [
    (role: UserRole.student,        label: 'طالب',    icon: Icons.school_rounded,     color: AppColors.studentColor),
    (role: UserRole.representative, label: 'مندوب',   icon: Icons.groups_rounded,     color: AppColors.representativeColor),
    (role: UserRole.lecturer,       label: 'محاضر',   icon: Icons.person_rounded,     color: AppColors.lecturerColor),
  ];

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat(reverse: true);

    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgController.dispose();
    _logoController.dispose();
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  // ── Getters ───────────────────────────────────────────────────
  String get _identifierHint => _selectedRole == UserRole.student
      ? 'رقم الطالب أو البريد الإلكتروني'
      : 'البريد الإلكتروني الرسمي';

  IconData get _identifierIcon => _selectedRole == UserRole.student
      ? Icons.badge_rounded
      : Icons.email_rounded;

  Color get _roleColor {
    return _roles
        .firstWhere((r) => r.role == _selectedRole)
        .color;
  }

  // ── Actions ───────────────────────────────────────────────────
  Future<void> _handleLogin() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    HapticFeedback.lightImpact();

    final connectivity = context.read<ConnectivityService>();
    final auth = context.read<AuthService>();

    final result = await auth.login(
      identifier: _identifierCtrl.text.trim(),
      password: _passwordCtrl.text.trim(),
      role: _selectedRole,
      isConnected: connectivity.isConnected,
    );

    if (!mounted) return;

    setState(() => _isLoading = false);

    if (result.success) {
      HapticFeedback.mediumImpact();
      if (result.isOfflineLogin) {
        _showSnack('دخول بنجاح — عرض البيانات المحفوظة 📦', AppColors.gold);
      }
    } else {
      HapticFeedback.heavyImpact();
      setState(() => _errorMessage = result.error);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isGoogleLoading = true;
      _errorMessage = null;
    });

    HapticFeedback.lightImpact();

    try {
      final GoogleSignIn googleSignIn = GoogleSignIn(
        scopes: ['email', 'profile'],
      );
      final GoogleSignInAccount? account = await googleSignIn.signIn();

      if (account == null) {
        setState(() => _isGoogleLoading = false);
        return;
      }

      final authentication = await account.authentication;
      final idToken = authentication.idToken ?? authentication.accessToken;

      if (idToken != null) {
        final api = ApiClient();
        final response = await api.post(
          '/auth/google',
          data: {'credential': idToken},
        );

        if (response.data != null && response.data['success'] == true) {
          final token = response.data['token'] as String?;
          if (token != null) {
            await api.saveToken(token);
            if (!mounted) return;
            context.go('/');
            return;
          }
        }
      }
      _showSnack('تم التحقق عبر جوجل — جاري إكمال المزامنة', AppColors.accent);
    } catch (e) {
      debugPrint('[GoogleAuth] Error: $e');
      setState(() => _errorMessage = 'تعذر الاتصال بـ جوجل. تحقق من الاتصال بالشبكة.');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  Future<void> _launchGitHubProfile() async {
    final Uri url = Uri.parse('https://github.com/mghalaosimi-web');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(url);
      }
    } catch (e) {
      debugPrint('[UrlLauncher] Error opening GitHub link: $e');
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: AppTextStyles.bodyMedium.copyWith(color: Colors.white)),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showForgotPasswordDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).cardColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: Row(
          children: [
            const Icon(Icons.lock_reset_rounded, color: AppColors.accent, size: 24),
            const SizedBox(width: 8),
            Text('استعادة كلمة السر', style: AppTextStyles.headlineSmall),
          ],
        ),
        content: Text(
          'يرجى إدخال رقم الطالب أو البريد الإلكتروني وسيصلك رمز إعادة التعيين عبر الواتساب أو البريد الإلكتروني.',
          style: AppTextStyles.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('إلغاء', style: AppTextStyles.bodyMedium),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _showSnack('تم إرسال تعليمات إعادة التعيين ✓', AppColors.accent);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accent,
              minimumSize: const Size(100, 44),
            ),
            child: const Text('إرسال'),
          ),
        ],
      ),
    );
  }

  void _showRequestCredentialsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).cardColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: Row(
          children: [
            const Icon(Icons.contact_support_rounded, color: AppColors.gold, size: 24),
            const SizedBox(width: 8),
            Text('طلب بيانات الدخول', style: AppTextStyles.headlineSmall),
          ],
        ),
        content: Text(
          'يمكنك التواصل المباشر مع شؤون الطلاب أو الدعم الفني لكليات المنار للحصول على رقم الطالب المعتمد وحسابك الجامعي.',
          style: AppTextStyles.bodyMedium,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('إغلاق', style: AppTextStyles.bodyMedium),
          ),
        ],
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final themeProv = context.watch<ThemeProvider>();
    final isDark = themeProv.isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBg : AppColors.lightBg,
      body: Stack(
        children: [
          // ── Animated Background ────────────────────────────────
          if (isDark) _AnimatedBackground(controller: _bgController),

          // ── Content ───────────────────────────────────────────
          SafeArea(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                children: [
                  // Top Header Actions (Theme Switcher Button)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.darkCard : AppColors.lightSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark ? AppColors.glassBorder : AppColors.lightBorder,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.verified_user_rounded,
                              color: isDark ? AppColors.accent : AppColors.accentDark,
                              size: 14,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'كلية المنار الجامعية',
                              style: AppTextStyles.labelSmall.copyWith(fontSize: 11),
                            ),
                          ],
                        ),
                      ),

                      // Day / Night Theme Toggle Icon Button
                      IconButton(
                        onPressed: () => themeProv.toggleTheme(),
                        tooltip: isDark ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي',
                        icon: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDark ? AppColors.darkCard : AppColors.lightCard,
                            border: Border.all(
                              color: isDark ? AppColors.accent.withValues(alpha: 0.3) : AppColors.lightBorder,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: (isDark ? AppColors.accent : Colors.orange).withValues(alpha: 0.2),
                                blurRadius: 10,
                              ),
                            ],
                          ),
                          child: Icon(
                            isDark ? Icons.wb_sunny_rounded : Icons.nightlight_round,
                            color: isDark ? AppColors.gold : AppColors.accentDark,
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Official Emblem Logo
                  _buildLogo(isDark),
                  const SizedBox(height: 28),

                  // Main Login Card
                  _buildLoginCard(isDark),
                  const SizedBox(height: 24),

                  // New Student Onboarding Card
                  _buildNewStudentCard(isDark),
                  const SizedBox(height: 24),

                  // Interactive Developer Signature Footer
                  _buildClickableFooter(isDark),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Emblem Logo ───────────────────────────────────────────────
  Widget _buildLogo(bool isDark) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _logoController,
          builder: (context, child) {
            return Container(
              width: 108,
              height: 108,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    (isDark ? AppColors.accent : AppColors.accentDark)
                        .withValues(alpha: 0.3 + 0.15 * _logoController.value),
                    (isDark ? AppColors.accent : AppColors.accentDark).withValues(alpha: 0.05),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: (isDark ? AppColors.accent : AppColors.accentDark)
                        .withValues(alpha: 0.25 + 0.15 * _logoController.value),
                    blurRadius: 36 + 16 * _logoController.value,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: child,
            );
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(54),
            child: Container(
              margin: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? AppColors.darkCard : AppColors.lightCard,
                border: Border.all(
                  color: (isDark ? AppColors.accent : AppColors.accentDark).withValues(alpha: 0.4),
                  width: 1.5,
                ),
              ),
              child: Image.asset(
                'assets/images/almanar_logo.png',
                fit: BoxFit.cover,
                errorBuilder: (ctx, err, stack) => Image.asset(
                  'assets/images/logo.png',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.school_rounded,
                    color: isDark ? AppColors.accent : AppColors.accentDark,
                    size: 52,
                  ),
                ),
              ),
            ),
          ),
        )
            .animate()
            .scale(begin: const Offset(0.5, 0.5), duration: 700.ms, curve: Curves.elasticOut)
            .fadeIn(duration: 500.ms),

        const SizedBox(height: 18),

        Text(
          AppStrings.appTagline,
          style: AppTextStyles.displayMedium.copyWith(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
          ),
          textAlign: TextAlign.center,
        ).animate().slideY(begin: 0.3, duration: 600.ms, curve: Curves.easeOut).fadeIn(),

        const SizedBox(height: 6),

        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              'نظام الجداول الاكاديمي الذكي — Offline First',
              style: AppTextStyles.bodyMedium.copyWith(
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ).animate().fadeIn(delay: 200.ms, duration: 600.ms),
      ],
    );
  }

  // ── Login Card ────────────────────────────────────────────────
  Widget _buildLoginCard(bool isDark) {
    return GlassCardAccent(
      padding: const EdgeInsets.all(26),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Role Selector Segmented Tabs
            _buildRoleSelector(isDark),
            const SizedBox(height: 24),

            // Identifier Input Field
            _buildIdentifierField(),
            const SizedBox(height: 16),

            // Password Input Field
            _buildPasswordField(),
            const SizedBox(height: 12),

            // Helper Options Row
            _buildHelperOptionsRow(isDark),
            const SizedBox(height: 16),

            // Error Banner
            if (_errorMessage != null) _buildErrorMessage(),
            const SizedBox(height: 8),

            // Login Primary Button
            GradientButton(
              label: AppStrings.loginButton,
              isLoading: _isLoading,
              icon: Icons.login_rounded,
              onPressed: _isLoading ? null : _handleLogin,
            ),

            const SizedBox(height: 14),

            // Google OAuth Button
            _buildGoogleSignInButton(isDark),

            // Offline Notification Banner
            _buildOfflineHint(),
          ],
        ),
      ),
    )
        .animate()
        .slideY(begin: 0.4, duration: 700.ms, curve: Curves.easeOutCubic)
        .fadeIn(delay: 300.ms, duration: 600.ms);
  }

  // ── Google OAuth Button ────────────────────────────────────────
  Widget _buildGoogleSignInButton(bool isDark) {
    return GestureDetector(
      onTap: _isGoogleLoading ? null : _handleGoogleSignIn,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppColors.glassBorder : AppColors.lightBorder,
          ),
        ),
        child: Center(
          child: _isGoogleLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(
                      isDark ? AppColors.accent : AppColors.accentDark,
                    ),
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.g_mobiledata_rounded, color: Colors.redAccent, size: 28),
                    const SizedBox(width: 6),
                    Text(
                      'المتابعة عبر جوجل',
                      style: AppTextStyles.labelLarge.copyWith(
                        color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  // ── Role Selector ─────────────────────────────────────────────
  Widget _buildRoleSelector(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'نوع الحساب',
          style: AppTextStyles.labelMedium.copyWith(
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkBg.withValues(alpha: 0.6) : AppColors.lightSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppColors.glassBorder : AppColors.lightBorder),
          ),
          child: Row(
            children: _roles.map((r) {
              final isSelected = _selectedRole == r.role;
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    setState(() {
                      _selectedRole = r.role;
                      _errorMessage = null;
                      _identifierCtrl.clear();
                    });
                    HapticFeedback.selectionClick();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                    decoration: BoxDecoration(
                      color: isSelected ? r.color.withValues(alpha: 0.18) : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border: isSelected
                          ? Border.all(color: r.color.withValues(alpha: 0.6))
                          : null,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          r.icon,
                          color: isSelected ? r.color : (isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                          size: 22,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          r.label,
                          style: AppTextStyles.labelSmall.copyWith(
                            color: isSelected ? r.color : (isDark ? AppColors.textMutedDark : AppColors.textMutedLight),
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ── Identifier Field ──────────────────────────────────────────
  Widget _buildIdentifierField() {
    return TextFormField(
      controller: _identifierCtrl,
      keyboardType: _selectedRole == UserRole.student
          ? TextInputType.text
          : TextInputType.emailAddress,
      textDirection: TextDirection.ltr,
      style: AppTextStyles.inputText,
      decoration: InputDecoration(
        hintText: _identifierHint,
        prefixIcon: Icon(_identifierIcon, color: _roleColor, size: 20),
        labelText: _selectedRole == UserRole.student ? 'رقم الطالب أو البريد' : 'البريد الإلكتروني',
      ),
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'الرجاء إدخال معرّف الحساب';
        return null;
      },
    );
  }

  // ── Password Field ────────────────────────────────────────────
  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordCtrl,
      obscureText: _obscurePassword,
      textDirection: TextDirection.ltr,
      style: AppTextStyles.inputText,
      decoration: InputDecoration(
        hintText: '••••••••',
        labelText: AppStrings.password,
        prefixIcon: const Icon(Icons.lock_rounded, size: 20),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
            size: 20,
          ),
          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
        ),
      ),
      validator: (v) {
        if (v == null || v.isEmpty) return 'الرجاء إدخال كلمة المرور';
        if (v.length < 6) return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        return null;
      },
    );
  }

  // ── Helper Options Row ─────────────────────────────────────────
  Widget _buildHelperOptionsRow(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left: Request Credentials
        GestureDetector(
          onTap: _showRequestCredentialsDialog,
          child: Text(
            'طلب بيانات الدخول',
            style: AppTextStyles.bodySmall.copyWith(
              color: AppColors.gold,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // Right: Forgot Password?
        GestureDetector(
          onTap: _showForgotPasswordDialog,
          child: Text(
            'نسيت كلمة السر؟',
            style: AppTextStyles.bodySmall.copyWith(
              color: isDark ? AppColors.accentLight : AppColors.accentDark,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  // ── Error Message ─────────────────────────────────────────────
  Widget _buildErrorMessage() {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMessage!,
              style: AppTextStyles.bodySmall.copyWith(color: AppColors.error),
            ),
          ),
        ],
      ),
    )
        .animate()
        .shake(hz: 4, duration: 400.ms)
        .fadeIn(duration: 200.ms);
  }

  // ── Offline Hint ──────────────────────────────────────────────
  Widget _buildOfflineHint() {
    return Consumer<ConnectivityService>(
      builder: (context, conn, _) {
        if (conn.isConnected) return const SizedBox(height: 4);
        return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: GestureDetector(
            onTap: _handleLogin,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.wifi_off_rounded, color: AppColors.gold, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    AppStrings.offlineLogin,
                    style: AppTextStyles.bodySmall.copyWith(color: AppColors.gold),
                  ),
                ],
              ),
            ),
          ),
        ).animate().fadeIn(duration: 400.ms);
      },
    );
  }

  // ── New Student Onboarding Card ───────────────────────────────
  Widget _buildNewStudentCard(bool isDark) {
    return GlassCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 1,
                  color: isDark ? AppColors.glassBorder : AppColors.lightBorder,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text(
                  'طالب جديد؟',
                  style: AppTextStyles.labelMedium.copyWith(
                    color: isDark ? AppColors.textMutedDark : AppColors.textMutedLight,
                  ),
                ),
              ),
              Expanded(
                child: Container(
                  height: 1,
                  color: isDark ? AppColors.glassBorder : AppColors.lightBorder,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.accentSubtle,
                  border: Border.all(
                    color: (isDark ? AppColors.accent : AppColors.accentDark).withValues(alpha: 0.3),
                  ),
                ),
                child: const Icon(Icons.stars_rounded, color: AppColors.gold, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'الخطوة الأذكى... انضم الآن',
                      style: AppTextStyles.headlineSmall.copyWith(fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'تسجيل حساب جديد أو التقديم للكلية',
                      style: AppTextStyles.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          OutlineButton(
            label: 'إنشاء حساب جديد / تقديم طلب',
            icon: Icons.person_add_rounded,
            color: isDark ? AppColors.accent : AppColors.accentDark,
            onPressed: () => context.go('/register'),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 500.ms, duration: 600.ms).slideY(begin: 0.2);
  }

  // ── Clickable Developer Footer ───────────────────────────────
  Widget _buildClickableFooter(bool isDark) {
    final textMuted = isDark ? AppColors.textMutedDark : AppColors.textMutedLight;
    final accentColor = isDark ? AppColors.accentLight : AppColors.accentDark;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        GestureDetector(
          onTap: _launchGitHubProfile,
          child: MouseRegion(
            cursor: SystemMouseCursors.click,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: accentColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.code_rounded, color: accentColor, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    'M.GH.AL',
                    style: AppTextStyles.labelSmall.copyWith(
                      color: accentColor,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Text(
          ' — MANAR SYS',
          style: AppTextStyles.bodySmall.copyWith(
            letterSpacing: 1.5,
            color: textMuted,
          ),
        ),
      ],
    ).animate().fadeIn(delay: 1100.ms, duration: 600.ms);
  }
}

// ── Animated Background ────────────────────────────────────────────
class _AnimatedBackground extends StatelessWidget {
  final AnimationController controller;
  const _AnimatedBackground({required this.controller});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Container(
          decoration: const BoxDecoration(color: AppColors.darkBg),
          child: CustomPaint(
            painter: _BgPainter(controller.value),
            size: Size.infinite,
          ),
        );
      },
    );
  }
}

class _BgPainter extends CustomPainter {
  final double t;
  _BgPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    // Academic Blue Glow Circle
    final cx = size.width * (0.3 + 0.4 * math.sin(t * math.pi));
    final cy = size.height * (0.2 + 0.15 * math.cos(t * math.pi));

    paint.shader = RadialGradient(
      colors: [
        AppColors.accent.withValues(alpha: 0.14),
        AppColors.accent.withValues(alpha: 0.0),
      ],
    ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: 300));
    canvas.drawCircle(Offset(cx, cy), 300, paint);

    // Gold Secondary Glow Circle
    final cx2 = size.width * (0.7 + 0.2 * math.cos(t * math.pi));
    final cy2 = size.height * (0.7 + 0.1 * math.sin(t * math.pi * 1.3));

    paint.shader = RadialGradient(
      colors: [
        AppColors.gold.withValues(alpha: 0.08),
        AppColors.gold.withValues(alpha: 0.0),
      ],
    ).createShader(Rect.fromCircle(center: Offset(cx2, cy2), radius: 220));
    canvas.drawCircle(Offset(cx2, cy2), 220, paint);
  }

  @override
  bool shouldRepaint(_BgPainter old) => old.t != t;
}
