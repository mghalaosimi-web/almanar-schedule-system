import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../data/local/hive_boxes.dart';
import '../models/user_model.dart';

/// نتيجة عملية المصادقة
class AuthResult {
  final bool success;
  final String? error;
  final UserModel? user;
  final bool isOfflineLogin;

  const AuthResult({
    required this.success,
    this.error,
    this.user,
    this.isOfflineLogin = false,
  });
}

/// خدمة المصادقة — تتعامل مع Login/Logout وحفظ JWT
class AuthService extends ChangeNotifier {
  AuthService._internal();
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;

  final _api = ApiClient();
  UserModel? _currentUser;
  bool _isLoading = false;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isLoggedIn => _currentUser != null;

  /// تهيئة الخدمة — يُحمّل المستخدم المحفوظ إن وُجد
  Future<void> init() async {
    try {
      final box = Hive.box<UserModel>(HiveBoxes.currentUser);
      if (box.isNotEmpty) {
        _currentUser = box.values.first;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[AuthService] init error: $e');
    }
  }

  /// تسجيل الدخول الموحد لجميع الأدوار
  Future<AuthResult> login({
    required String identifier, // email أو studentId
    required String password,
    required UserRole role,
    bool isConnected = true,
  }) async {
    // ── Offline Mode ─────────────────────────────────────────────
    if (!isConnected) {
      return _tryOfflineLogin();
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiEndpoints.login,
        data: {
          'email': identifier,
          'studentId': identifier,
          'password': password,
          'role': role.name,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final token = data['token'] as String? ?? data['accessToken'] as String?;
      final userData = data['user'] as Map<String, dynamic>? ?? data;

      if (token == null) {
        return const AuthResult(success: false, error: 'لم يُرسَل token من السيرفر');
      }

      // حفظ الـ Token
      await _api.saveToken(token);

      // حفظ بيانات المستخدم
      final user = UserModel.fromJson(userData);
      await _saveUser(user);

      _currentUser = user;
      return AuthResult(success: true, user: user);
    } on DioException catch (e) {
      final msg = _parseDioError(e);
      return AuthResult(success: false, error: msg);
    } catch (e) {
      return AuthResult(success: false, error: 'حدث خطأ غير متوقع');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// محاولة الدخول من الكاش المحلي (بدون إنترنت)
  AuthResult _tryOfflineLogin() {
    try {
      final box = Hive.box<UserModel>(HiveBoxes.currentUser);
      if (box.isNotEmpty) {
        _currentUser = box.values.first;
        notifyListeners();
        return AuthResult(
          success: true,
          user: _currentUser,
          isOfflineLogin: true,
        );
      }
    } catch (_) {}
    return const AuthResult(
      success: false,
      error: 'لا توجد بيانات محفوظة. اتصل بالإنترنت أولاً',
    );
  }

  /// تسجيل الخروج
  Future<void> logout() async {
    await _api.clearToken();
    final box = Hive.box<UserModel>(HiveBoxes.currentUser);
    await box.clear();
    _currentUser = null;
    notifyListeners();
  }

  Future<void> _saveUser(UserModel user) async {
    final box = Hive.box<UserModel>(HiveBoxes.currentUser);
    await box.clear();
    await box.add(user);
  }

  String _parseDioError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'انتهت مهلة الاتصال. تحقق من الإنترنت';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'لا يوجد اتصال بالإنترنت';
    }
    final statusCode = e.response?.statusCode;
    if (statusCode == 401 || statusCode == 403) {
      return 'بيانات الدخول غير صحيحة';
    }
    if (statusCode == 404) {
      return 'الحساب غير موجود';
    }
    if (statusCode != null && statusCode >= 500) {
      return 'خطأ في السيرفر. حاول لاحقاً';
    }
    final serverMsg = e.response?.data?['message'] as String?;
    return serverMsg ?? 'حدث خطأ في تسجيل الدخول';
  }
}
