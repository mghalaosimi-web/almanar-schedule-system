import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'hive_boxes.dart';

/// عنصر المزامنة المؤجلة
class SyncItem {
  final String id;
  final String actionType; // 'ATTENDANCE', 'OVERRIDE_REQUEST', 'BROADCAST'
  final String endpoint;
  final Map<String, dynamic> payload;
  final DateTime createdAt;

  SyncItem({
    required this.id,
    required this.actionType,
    required this.endpoint,
    required this.payload,
    required this.createdAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'actionType': actionType,
        'endpoint': endpoint,
        'payload': payload,
        'createdAt': createdAt.toIso8601String(),
      };

  factory SyncItem.fromJson(Map<String, dynamic> json) => SyncItem(
        id: json['id'] as String,
        actionType: json['actionType'] as String,
        endpoint: json['endpoint'] as String,
        payload: Map<String, dynamic>.from(json['payload'] as Map),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// DAO لإدارة طابور المزامنة التلقائية عند التواجد أوفلاين
class SyncQueueDao {
  SyncQueueDao._internal();
  static final SyncQueueDao instance = SyncQueueDao._internal();

  Box? _box;

  Box get box {
    if (_box == null || !_box!.isOpen) {
      _box = Hive.box(HiveBoxes.syncQueue);
    }
    return _box!;
  }

  /// إضافة عملية مؤجلة إلى طابور المزامنة
  Future<void> enqueue({
    required String actionType,
    required String endpoint,
    required Map<String, dynamic> payload,
  }) async {
    final id = '${DateTime.now().millisecondsSinceEpoch}_$actionType';
    final item = SyncItem(
      id: id,
      actionType: actionType,
      endpoint: endpoint,
      payload: payload,
      createdAt: DateTime.now(),
    );
    await box.put(id, item.toJson());
    debugPrint('[SyncQueueDao] Enqueued offline action: $actionType ($id)');
  }

  /// جلب كافة العناصر المعلقة في الطابور
  List<SyncItem> getQueue() {
    final list = <SyncItem>[];
    for (var key in box.keys) {
      final val = box.get(key);
      if (val is Map) {
        try {
          list.add(SyncItem.fromJson(Map<String, dynamic>.from(val)));
        } catch (e) {
          debugPrint('[SyncQueueDao] Error parsing item: $e');
        }
      }
    }
    list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return list;
  }

  /// حذف عنصر بعد نجاح مزامنته بالسيرفر
  Future<void> dequeue(String id) async {
    await box.delete(id);
    debugPrint('[SyncQueueDao] Dequeued synced action: $id');
  }

  /// عدد العمليات المعلقة في الطابور
  int get pendingCount => box.length;
}
