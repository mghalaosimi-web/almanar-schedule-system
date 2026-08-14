import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/constants/api_endpoints.dart';

/// HTTP Client مع JWT interceptor
/// يُضيف Authorization header تلقائياً لكل طلب
class ApiClient {
  ApiClient._internal();
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  final _storage = const FlutterSecureStorage();
  late final Dio _dio;

  Dio get dio => _dio;

  Future<void> init() async {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // ── JWT Interceptor ──────────────────────────────────────────
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'jwt_token');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // 401 = انتهاء الجلسة → يُعيد للدخول
          if (e.response?.statusCode == 401) {
            await clearToken();
          }
          return handler.next(e);
        },
      ),
    );

    // ── Logging (Debug only) ─────────────────────────────────────
    assert(() {
      _dio.interceptors.add(LogInterceptor(
        requestBody: true,
        responseBody: true,
        error: true,
        requestHeader: false,
      ));
      return true;
    }());
  }

  // ── Token Management ─────────────────────────────────────────────
  Future<void> saveToken(String token) async {
    await _storage.write(key: 'jwt_token', value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'jwt_token');
  }

  Future<void> clearToken() async {
    await _storage.delete(key: 'jwt_token');
  }

  Future<bool> hasToken() async {
    final t = await _storage.read(key: 'jwt_token');
    return t != null && t.isNotEmpty;
  }

  // ── Requests ─────────────────────────────────────────────────────
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    return _dio.get(path, queryParameters: queryParameters, options: options);
  }

  Future<Response> post(
    String path, {
    dynamic data,
    Options? options,
  }) async {
    return _dio.post(path, data: data, options: options);
  }

  Future<Response> put(
    String path, {
    dynamic data,
    Options? options,
  }) async {
    return _dio.put(path, data: data, options: options);
  }
}
