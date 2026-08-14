import 'package:hive/hive.dart';

part 'user_model.g.dart';

enum UserRole { student, representative, lecturer }

/// موديل المستخدم المُخزَّن محلياً في Hive بعد تسجيل الدخول
@HiveType(typeId: 1)
class UserModel extends HiveObject {
  @HiveField(0)
  String id;

  @HiveField(1)
  String name;

  @HiveField(2)
  String email;

  @HiveField(3)
  String roleStr; // 'student', 'representative', 'lecturer'

  @HiveField(4)
  String major;

  @HiveField(5)
  String level;

  @HiveField(6)
  String group;

  @HiveField(7)
  String? studentId; // رقم الطالب الجامعي مثل 2026-TEST01

  @HiveField(8)
  String? phone;

  @HiveField(9)
  String? avatarUrl;

  @HiveField(10)
  DateTime createdAt;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.roleStr,
    required this.major,
    required this.level,
    required this.group,
    this.studentId,
    this.phone,
    this.avatarUrl,
    required this.createdAt,
  });

  UserRole get role {
    switch (roleStr.toLowerCase()) {
      case 'representative':
      case 'rep':
        return UserRole.representative;
      case 'lecturer':
      case 'teacher':
        return UserRole.lecturer;
      default:
        return UserRole.student;
    }
  }

  bool get isStudent        => role == UserRole.student;
  bool get isRepresentative => role == UserRole.representative;
  bool get isLecturer       => role == UserRole.lecturer;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roleStr: json['role'] as String? ?? 'student',
      major: json['major'] as String? ??
          json['majorName'] as String? ?? '',
      level: json['level']?.toString() ?? '',
      group: json['group'] as String? ?? '',
      studentId: json['studentId'] as String?,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      createdAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': roleStr,
        'major': major,
        'level': level,
        'group': group,
        'studentId': studentId,
        'phone': phone,
        'avatarUrl': avatarUrl,
      };
}
