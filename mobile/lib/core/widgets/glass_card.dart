import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// بطاقة زجاجية قابلة لإعادة الاستخدام تتكيف تلقائياً مع الثيم
class GlassCard extends StatelessWidget {
  final Widget child;
  final double? width;
  final double? height;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final double blurAmount;
  final Color? backgroundColor;
  final Color? borderColor;
  final VoidCallback? onTap;
  final List<BoxShadow>? shadow;

  const GlassCard({
    super.key,
    required this.child,
    this.width,
    this.height,
    this.padding = const EdgeInsets.all(20),
    this.margin,
    this.borderRadius = 24,
    this.blurAmount = 20,
    this.backgroundColor,
    this.borderColor,
    this.onTap,
    this.shadow,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultBg = isDark
        ? AppColors.darkCard.withValues(alpha: 0.8)
        : AppColors.lightCard.withValues(alpha: 0.9);
    final defaultBd = isDark
        ? AppColors.accent.withValues(alpha: 0.18)
        : AppColors.lightBorder;

    final bgColor = backgroundColor ?? defaultBg;
    final bdColor = borderColor ?? defaultBd;

    Widget card = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurAmount, sigmaY: blurAmount),
        child: Container(
          width: width,
          height: height,
          padding: padding,
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(color: bdColor, width: 1),
            boxShadow: shadow ?? [
              BoxShadow(
                color: isDark
                    ? AppColors.accent.withValues(alpha: 0.08)
                    : Colors.black.withValues(alpha: 0.04),
                blurRadius: 24,
                spreadRadius: -4,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );

    if (margin != null) {
      card = Padding(padding: margin!, child: card);
    }

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: card);
    }

    return card;
  }
}

/// نسخة مُسلطة الضوء من GlassCard (حدود أكسنت)
class GlassCardAccent extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;

  const GlassCardAccent({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.margin,
    this.borderRadius = 24,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? AppColors.accent : AppColors.accentDark;

    return GlassCard(
      padding: padding,
      margin: margin,
      borderRadius: borderRadius,
      borderColor: accentColor.withValues(alpha: 0.35),
      shadow: [
        BoxShadow(
          color: accentColor.withValues(alpha: 0.12),
          blurRadius: 36,
          spreadRadius: -4,
          offset: const Offset(0, 8),
        ),
      ],
      child: child,
    );
  }
}
