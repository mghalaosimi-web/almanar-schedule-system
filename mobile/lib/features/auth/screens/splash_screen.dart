import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/services/version_service.dart';
import '../../auth/services/auth_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _glowController;

  @override
  void initState() {
    super.initState();
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _navigateToNext();
  }

  Future<void> _navigateToNext() async {
    await Future.delayed(const Duration(milliseconds: 2600));
    if (!mounted) return;

    // ── Version Check Gate (P1 Update Engine) ───────────────
    await VersionService.promptUpdateIfAvailable(context);

    if (!mounted) return;
    final auth = context.read<AuthService>();
    if (auth.isLoggedIn) {
      context.go('/');
    } else {
      context.go('/login');
    }
  }

  @override
  void dispose() {
    _glowController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: Stack(
        children: [
          // ── Background Glow ─────────────────────────────
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _glowController,
              builder: (context, child) {
                return Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.8 + (0.2 * _glowController.value),
                      colors: [
                        AppColors.accent.withValues(alpha: 0.15 + (0.1 * _glowController.value)),
                        AppColors.darkBg,
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Splash Content ───────────────────────────────
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Glowing Logo Container
                AnimatedBuilder(
                  animation: _glowController,
                  builder: (context, child) {
                    return Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accent.withValues(alpha: 0.35 + (0.2 * _glowController.value)),
                            blurRadius: 40 + (20 * _glowController.value),
                            spreadRadius: 6,
                          ),
                        ],
                      ),
                      child: child,
                    );
                  },
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(70),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.cardBg,
                        border: Border.all(
                          color: AppColors.accent.withValues(alpha: 0.6),
                          width: 2,
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: Image.asset(
                        'assets/images/logo.png',
                        fit: BoxFit.cover,
                        errorBuilder: (ctx, err, stack) {
                          return Container(
                            color: AppColors.accentSubtle,
                            child: const Icon(
                              Icons.school_rounded,
                              color: AppColors.accent,
                              size: 70,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                )
                    .animate()
                    .scale(begin: const Offset(0.3, 0.3), duration: 900.ms, curve: Curves.elasticOut)
                    .fadeIn(duration: 600.ms),

                const SizedBox(height: 32),

                // Title
                Text(
                  AppStrings.appTagline,
                  style: AppTextStyles.displayLarge.copyWith(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                  textAlign: TextAlign.center,
                )
                    .animate()
                    .fadeIn(delay: 400.ms, duration: 600.ms)
                    .slideY(begin: 0.4, curve: Curves.easeOutCubic),

                const SizedBox(height: 8),

                // Subtitle with Shimmer
                Text(
                  'نظام الجداول الجامعي الذكي — Offline First',
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: AppColors.accent,
                    fontWeight: FontWeight.w600,
                  ),
                )
                    .animate()
                    .fadeIn(delay: 700.ms, duration: 600.ms)
                    .shimmer(delay: 1300.ms, duration: 1500.ms, color: Colors.white),

                const SizedBox(height: 60),

                // Smooth Progress Indicator
                SizedBox(
                  width: 160,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      backgroundColor: AppColors.glassBorder,
                      valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accent),
                      minHeight: 4,
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(delay: 900.ms, duration: 500.ms),
              ],
            ),
          ),

          // ── Dev Signature Footer ──────────────────────────
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Text(
              AppStrings.devSignature,
              style: AppTextStyles.bodySmall.copyWith(
                letterSpacing: 2.0,
                color: AppColors.textMuted,
              ),
              textAlign: TextAlign.center,
            ).animate().fadeIn(delay: 1100.ms, duration: 600.ms),
          ),
        ],
      ),
    );
  }
}
