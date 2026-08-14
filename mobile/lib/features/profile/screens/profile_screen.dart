import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/gradient_button.dart' as gb;
import '../../auth/models/user_model.dart';
import '../../auth/services/auth_service.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: AppBar(
        title: Text('حسابي', style: AppTextStyles.headlineSmall),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const SizedBox(height: 16),
            // ── Avatar ──────────────────────────────────────────
            _buildAvatar(user),
            const SizedBox(height: 24),

            // ── Info Card ────────────────────────────────────────
            if (user != null) _buildInfoCard(user),
            const SizedBox(height: 16),

            // ── Role Badge ───────────────────────────────────────
            if (user != null) _buildRoleBadge(user),
            const SizedBox(height: 32),

            // ── Logout ───────────────────────────────────────────
            gb.GradientButton(
              label: AppStrings.logout,
              icon: Icons.logout_rounded,
              gradientColors: [AppColors.error.withOpacity(0.8), AppColors.error],
              onPressed: () => _confirmLogout(context, auth),
            ),
            const SizedBox(height: 24),

            // ── Signature ────────────────────────────────────────
            Text(AppStrings.devSignature,
                style: AppTextStyles.bodySmall.copyWith(letterSpacing: 1.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatar(UserModel? user) {
    return Column(
      children: [
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.accentSubtle,
            border: Border.all(color: AppColors.accent.withOpacity(0.4), width: 2.5),
            boxShadow: [
              BoxShadow(
                color: AppColors.accent.withOpacity(0.2),
                blurRadius: 24,
                spreadRadius: 4,
              ),
            ],
          ),
          child: const Icon(Icons.person_rounded, color: AppColors.accent, size: 52),
        )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .scale(end: const Offset(1.04, 1.04), duration: 2000.ms),
        const SizedBox(height: 16),
        Text(
          user?.name ?? '—',
          style: AppTextStyles.displayMedium.copyWith(fontSize: 22),
        ),
        const SizedBox(height: 4),
        Text(user?.email ?? '', style: AppTextStyles.bodyMedium),
      ],
    );
  }

  Widget _buildInfoCard(UserModel user) {
    final rows = [
      ('التخصص',    user.major,      Icons.school_rounded),
      ('المستوى',   'المستوى ${user.level}', Icons.stairs_rounded),
      ('الشعبة',    user.group,      Icons.group_rounded),
      if (user.studentId != null)
        ('الرقم الجامعي', user.studentId!, Icons.badge_rounded),
      if (user.phone != null)
        ('الهاتف', user.phone!, Icons.phone_rounded),
    ];

    return GlassCard(
      child: Column(
        children: rows.asMap().entries.map((e) {
          final (label, value, icon) = e.value;
          return Column(
            children: [
              if (e.key > 0) const Divider(height: 1, color: AppColors.glassBorder),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Row(
                  children: [
                    Icon(icon, color: AppColors.accent, size: 18),
                    const SizedBox(width: 12),
                    Text(label, style: AppTextStyles.bodyMedium),
                    const Spacer(),
                    Text(value, style: AppTextStyles.labelLarge),
                  ],
                ),
              ),
            ],
          );
        }).toList(),
      ),
    ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2);
  }

  Widget _buildRoleBadge(UserModel user) {
    final (label, color, icon) = switch (user.role) {
      UserRole.student        => ('طالب', AppColors.studentColor, Icons.school_rounded),
      UserRole.representative => ('مندوب', AppColors.representativeColor, Icons.groups_rounded),
      UserRole.lecturer       => ('محاضر', AppColors.lecturerColor, Icons.person_rounded),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Text('صلاحية: $label', style: AppTextStyles.labelLarge.copyWith(color: color)),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms).scale();
  }

  void _confirmLogout(BuildContext context, AuthService auth) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('تسجيل الخروج', style: AppTextStyles.headlineSmall),
        content: Text('هل أنت متأكد من تسجيل الخروج؟',
            style: AppTextStyles.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('إلغاء', style: AppTextStyles.accentLabel),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              auth.logout();
            },
            child: Text('خروج',
                style: AppTextStyles.accentLabel.copyWith(
                    color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}
