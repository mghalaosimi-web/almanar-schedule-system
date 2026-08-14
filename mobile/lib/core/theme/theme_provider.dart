import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../data/local/hive_boxes.dart';

class ThemeProvider extends ChangeNotifier {
  static const String _themeKey = 'is_dark_mode';
  late Box _settingsBox;

  bool _isDarkMode = true;
  bool get isDarkMode => _isDarkMode;

  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;

  Future<void> init() async {
    _settingsBox = Hive.box(HiveBoxes.settings);
    _isDarkMode = _settingsBox.get(_themeKey, defaultValue: true) as bool;
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    await _settingsBox.put(_themeKey, _isDarkMode);
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _isDarkMode = value;
    await _settingsBox.put(_themeKey, value);
    notifyListeners();
  }
}
