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
  final String status; // 'PROFILE_COMPLETE', 'PROFILE_INCOMPLETE', 'NEW_ACCOUNT', 'ERROR'
  final List<String> missingFields;
  final Map<String, dynamic>? googleData;

  const AuthResult({
    required this.success,
    this.error,
    this.user,
    this.isOfflineLogin = false,
    this.status = 'PROFILE_COMPLETE',
    this.missingFields = const [],
    this.googleData,
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

  /// تسجيل الدخول بالحساب وكلمة المرور دون إجبار تحديد Role (مع الدعم الكامل لـ Offline First)
  Future<AuthResult> login({
    required String identifier,
    required String password,
    UserRole? role,
    bool isConnected = true,
  }) async {
    // 1. إذا كان لا يوجد إنترنت، جرب الدخول الأوفلاين فوراً من الكاش المحلي
    if (!isConnected) {
      return _tryOfflineLogin(identifier: identifier);
    }

    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiEndpoints.login,
        data: {
          'identifier': identifier,
          'password': password,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final token = data['token'] as String? ?? data['accessToken'] as String?;
      final userData = data['user'] as Map<String, dynamic>? ?? data;

      if (token == null) {
        return const AuthResult(success: false, error: 'لم يُرسَل token من السيرفر', status: 'ERROR');
      }

      await _api.saveToken(token);
      final user = UserModel.fromJson(userData);
      await _saveUser(user);

      _currentUser = user;
      return AuthResult(success: true, user: user, status: 'PROFILE_COMPLETE');
    } on DioException catch (e) {
      // 2. إذا فشل الاتصال بالسيرفر أو انقطعت الشبكة، افحص الكاش المحلي قبل إظهار أي خطأ!
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.response == null ||
          (e.response?.statusCode != null && e.response!.statusCode! >= 500)) {
        final offlineResult = _tryOfflineLogin(identifier: identifier);
        if (offlineResult.success) {
          return offlineResult;
        }
      }
      final msg = _parseDioError(e);
      return AuthResult(success: false, error: msg, status: 'ERROR');
    } catch (e) {
      final offlineResult = _tryOfflineLogin(identifier: identifier);
      if (offlineResult.success) {
        return offlineResult;
      }
      return const AuthResult(success: false, error: 'حدث خطأ غير متوقع', status: 'ERROR');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }


  /// معالجة استجابة تسجيل الدخول عبر Google
  Future<AuthResult> handleGoogleSignIn(String idToken) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post(
        '/auth/google',
        data: {'credential': idToken},
      );

      final data = response.data as Map<String, dynamic>;
      final isSuccess = data['success'] == true;
      final status = data['status'] as String? ?? (isSuccess ? 'PROFILE_COMPLETE' : 'ERROR');

      if (status == 'AMBIGUOUS_ACCOUNT' || data['code'] == 'AMBIGUOUS_IDENTITY') {
        return AuthResult(
          success: false,
          status: 'AMBIGUOUS_ACCOUNT',
          error: data['error'] as String? ?? 'تم العثور على أكثر من حساب مرتبط بهذا البريد الإلكتروني. يرجى التواصل مع إدارة الجامعة.',
        );
      }

      if (status == 'NEW_ACCOUNT' || data['code'] == 'ACCOUNT_NOT_FOUND') {
        final googleData = (data['googleData'] as Map<String, dynamic>?) ?? {};
        return AuthResult(
          success: false,
          status: 'NEW_ACCOUNT',
          error: data['error'] as String? ?? 'لا يوجد لديك حساب حتى الآن',
          googleData: googleData,
        );
      }

      if (isSuccess) {
        final token = data['token'] as String?;
        final userData = data['user'] as Map<String, dynamic>?;

        if (token != null) {
          await _api.saveToken(token);
        }

        if (userData != null) {
          final user = UserModel.fromJson(userData);
          if (status == 'PROFILE_COMPLETE') {
            await _saveUser(user);
            _currentUser = user;
          }
          return AuthResult(
            success: true,
            status: status,
            user: user,
            missingFields: (data['missingFields'] as List?)?.map((e) => e.toString()).toList() ?? [],
          );
        }
      }

      return AuthResult(
        success: false,
        status: 'ERROR',
        error: data['error'] as String? ?? 'فشل تسجيل الدخول عبر جوجل',
      );
    } on DioException catch (e) {
      return AuthResult(success: false, status: 'ERROR', error: _parseDioError(e));
    } catch (e) {
      return const AuthResult(success: false, status: 'ERROR', error: 'تعذر الاتصال بـ جوجل');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// إكمال البيانات الناقصة فقط بالحساب الموجود
  Future<AuthResult> completeProfile({
    required String name,
    required String phone,
    String? idNumber,
    required int collegeId,
    required int majorId,
    required int levelId,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.post(
        '/auth/complete-profile',
        data: {
          'name': name,
          'phone': phone,
          'idNumber': idNumber,
          'collegeId': collegeId,
          'majorId': majorId,
          'levelId': levelId,
        },
      );

      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true) {
        final token = data['token'] as String?;
        final userData = data['user'] as Map<String, dynamic>?;

        if (token != null) await _api.saveToken(token);
        if (userData != null) {
          final user = UserModel.fromJson(userData);
          await _saveUser(user);
          _currentUser = user;
          return AuthResult(success: true, status: 'PROFILE_COMPLETE', user: user);
        }
      }

      return AuthResult(
        success: false,
        status: 'ERROR',
        error: data['error'] as String? ?? 'فشل إكمال بيانات الحساب',
      );
    } on DioException catch (e) {
      return AuthResult(success: false, status: 'ERROR', error: _parseDioError(e));
    } catch (e) {
      return const AuthResult(success: false, status: 'ERROR', error: 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// إرسال طلب استعادة كلمة المرور عبر الواتساب
  Future<AuthResult> requestPasswordReset(String phone) async {
    try {
      final response = await _api.post(
        '/auth/forgot-password',
        data: {'phone': phone},
      );

      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true) {
        return AuthResult(
          success: true,
          status: 'RESET_REQUESTED',
          error: data['message'] as String? ?? 'تم إرسال طلب استعادة كلمة المرور بنجاح ✓',
        );
      }
      return AuthResult(
        success: false,
        status: 'ERROR',
        error: data['error'] as String? ?? 'فشل إرسال طلب الاستعادة',
      );
    } on DioException catch (e) {
      return AuthResult(success: false, status: 'ERROR', error: _parseDioError(e));
    } catch (e) {
      return const AuthResult(success: false, status: 'ERROR', error: 'حدث خطأ في الاتصال بالشبكة');
    }
  }

  /// محاولة الدخول من الكاش المحلي (بدون إنترنت أو عند تعذر الوصول للسيرفر)
  AuthResult _tryOfflineLogin({String? identifier}) {
    try {
      final box = Hive.box<UserModel>(HiveBoxes.currentUser);
      if (box.isNotEmpty) {
        final cachedUser = box.values.first;
        
        // إذا كان معرّف الدخول فارغاً أو يطابق إحدى خانات الحساب المحفوظ
        final idTrim = identifier?.trim().toLowerCase() ?? '';
        final matches = idTrim.isEmpty ||
            cachedUser.email.toLowerCase() == idTrim ||
            (cachedUser.phone != null && cachedUser.phone!.toLowerCase() == idTrim) ||
            (cachedUser.idNumber != null && cachedUser.idNumber!.toLowerCase() == idTrim) ||
            cachedUser.name.toLowerCase().contains(idTrim);

        if (matches) {
          _currentUser = cachedUser;
          notifyListeners();
          return AuthResult(
            success: true,
            user: _currentUser,
            isOfflineLogin: true,
            status: 'PROFILE_COMPLETE',
          );
        }
      }
    } catch (e) {
      debugPrint('[AuthService] Offline login error: $e');
    }
    return const AuthResult(
      success: false,
      error: 'لا توجد بيانات دخول محفوظة لهذا الحساب محلياً. يرجى الاتصال بالإنترنت أول مرة.',
      status: 'ERROR',
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
    final serverMsg = e.response?.data?['error'] as String? ?? e.response?.data?['message'] as String?;
    return serverMsg ?? 'حدث خطأ في تسجيل الدخول';
  }
}
