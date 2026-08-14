import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class LocalNotificationService {
  LocalNotificationService._internal();
  static final LocalNotificationService _instance = LocalNotificationService._internal();
  factory LocalNotificationService() => _instance;

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    try {
      await _notificationsPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('[Notification] User clicked notification: ${response.payload}');
        },
      );
      _isInitialized = true;
      debugPrint('[NotificationService] Local notification service initialized.');
    } catch (e) {
      debugPrint('[NotificationService] Initialization error: $e');
    }
  }

  /// إظهار إشعار فوري عند تعديل الجدول أو البث
  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_isInitialized) await init();

    const androidDetails = AndroidNotificationDetails(
      'manar_schedule_channel',
      'تحديثات الجدول وإعلانات المنار',
      channelDescription: 'إشعارات تغيير القاعات، تعديل الجداول، وتنبيهات المندوب',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _notificationsPlugin.show(id, title, body, details, payload: payload);
    } catch (e) {
      debugPrint('[NotificationService] Show error: $e');
    }
  }

  /// إرسال إشعار عند اكتشاف تغيير استثنائي بالجدول
  Future<void> notifyScheduleOverride({
    required String subject,
    required String newRoom,
    required String time,
  }) async {
    await showNotification(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: '⚠️ تعديل استثنائي في الجدول',
      body: 'تم تغيير قاعة $subject إلى $newRoom (الموعد: $time)',
    );
  }

  /// إرسال إشعار بث المندوب للمجموعة
  Future<void> notifyBroadcastReceived({
    required String mandoobName,
    required String message,
  }) async {
    await showNotification(
      id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title: '📢 إشعار جديد من المندوب ($mandoobName)',
      body: message,
    );
  }
}
