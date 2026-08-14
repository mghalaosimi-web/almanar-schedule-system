import 'package:flutter/material.dart';

/// Extension يُضيف alpha-safe color helpers
/// يُغني عن withOpacity المهجورة في Flutter 3.x+
extension ColorAlpha on Color {
  /// مكافئ withOpacity الآمن — يستخدم withValues
  Color alpha(double opacity) =>
      withValues(alpha: opacity.clamp(0.0, 1.0));
}
