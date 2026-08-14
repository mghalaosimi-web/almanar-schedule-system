import 'package:hive/hive.dart';

part 'schedule_entry.g.dart';

/// موديل حصة دراسية واحدة — يُخزن محلياً في Hive
@HiveType(typeId: 0)
class ScheduleEntry extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String day; // 'SUNDAY', 'MONDAY', etc.

  @HiveField(2)
  String subject;

  @HiveField(3)
  String subjectCode;

  @HiveField(4)
  String lecturer;

  @HiveField(5)
  String room;

  @HiveField(6)
  String timeStart; // '08:00'

  @HiveField(7)
  String timeEnd; // '10:00'

  @HiveField(8)
  bool isOverridden;

  @HiveField(9)
  String? overrideNote;

  @HiveField(10)
  DateTime cachedAt;

  @HiveField(11)
  String major;

  @HiveField(12)
  String level;

  @HiveField(13)
  String group;

  ScheduleEntry({
    required this.id,
    required this.day,
    required this.subject,
    required this.subjectCode,
    required this.lecturer,
    required this.room,
    required this.timeStart,
    required this.timeEnd,
    this.isOverridden = false,
    this.overrideNote,
    required this.cachedAt,
    required this.major,
    required this.level,
    required this.group,
  });

  /// تحويل من JSON السيرفر
  factory ScheduleEntry.fromJson(Map<String, dynamic> json) {
    // دعم كلا تنسيقي السيرفر
    final timeRaw = json['time'] as String? ?? '';
    String start = '';
    String end = '';
    if (timeRaw.contains(' - ')) {
      final parts = timeRaw.split(' - ');
      start = parts[0].trim();
      end = parts.length > 1 ? parts[1].trim() : '';
    } else {
      start = json['startTime'] as String? ?? '';
      end = json['endTime'] as String? ?? '';
    }

    return ScheduleEntry(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      day: (json['day'] as String? ?? '').toUpperCase(),
      subject: json['subject'] as String? ?? json['subjectName'] as String? ?? '',
      subjectCode: json['code'] as String? ?? json['subjectCode'] as String? ?? '',
      lecturer: json['lecturer'] as String? ?? json['lecturerName'] as String? ?? '',
      room: json['room'] as String? ?? json['roomName'] as String? ?? '',
      timeStart: start,
      timeEnd: end,
      isOverridden: json['isOverridden'] as bool? ?? false,
      overrideNote: json['overrideNote'] as String?,
      cachedAt: DateTime.now(),
      major: json['major'] as String? ?? '',
      level: json['level']?.toString() ?? '',
      group: json['group'] as String? ?? '',
    );
  }

  /// وقت الحصة كنص جاهز للعرض
  String get displayTime => '$timeStart - $timeEnd';

  /// هل الكاش قديم (+3 أيام)؟
  bool get isStale =>
      DateTime.now().difference(cachedAt).inDays >= 3;
}
