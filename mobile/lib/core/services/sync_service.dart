import 'package:flutter/foundation.dart';
import '../../data/local/sync_queue_dao.dart';
import '../../data/remote/api_client.dart';
import 'notification_service.dart';

/// خدمة المزامنة التلقائية في الخلفية عند عودة الاتصال
class BackgroundSyncService extends ChangeNotifier {
  BackgroundSyncService._internal();
  static final BackgroundSyncService instance = BackgroundSyncService._internal();

  final _dao = SyncQueueDao.instance;
  final _api = ApiClient();

  bool _isProcessing = false;
  bool get isProcessing => _isProcessing;

  int get pendingCount => _dao.pendingCount;

  /// معالجة العناصر المعلقة عند توفر الاتصال بالشبكة
  Future<void> processQueueIfOnline(bool isConnected) async {
    if (!isConnected || _isProcessing || _dao.pendingCount == 0) return;

    _isProcessing = true;
    notifyListeners();

    debugPrint('[SyncService] Processing ${_dao.pendingCount} offline pending actions...');
    final queue = _dao.getQueue();
    int successCount = 0;

    for (final item in queue) {
      try {
        final response = await _api.post(item.endpoint, data: item.payload);
        if (response.statusCode != null && response.statusCode! < 300) {
          await _dao.dequeue(item.id);
          successCount++;
        }
      } catch (e) {
        debugPrint('[SyncService] Failed to sync item ${item.id}: $e');
        // Continue processing next items
      }
    }

    _isProcessing = false;
    notifyListeners();

    if (successCount > 0) {
      await LocalNotificationService().showNotification(
        id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title: '⚡ اكتملت المزامنة التلقائية',
        body: 'تم رفع $successCount عمليات معلقة بنجاح إلى سيرفر الكلية ✓',
      );
    }
  }
}
