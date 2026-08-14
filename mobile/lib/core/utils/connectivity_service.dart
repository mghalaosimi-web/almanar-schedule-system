import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

/// خدمة مراقبة الاتصال بالإنترنت
/// يمكن الاستماع لـ [isConnected] كـ ValueNotifier في أي مكان بالتطبيق
class ConnectivityService extends ChangeNotifier {
  ConnectivityService._internal();
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  bool _isConnected = true;
  bool get isConnected => _isConnected;

  /// تهيئة الخدمة وبدء الاستماع
  Future<void> init() async {
    final result = await _connectivity.checkConnectivity();
    _updateFromResults(result);

    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      _updateFromResults(results);
    });
  }

  void _updateFromResults(List<ConnectivityResult> results) {
    final wasConnected = _isConnected;
    _isConnected = results.any((r) => r != ConnectivityResult.none);
    if (_isConnected != wasConnected) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
