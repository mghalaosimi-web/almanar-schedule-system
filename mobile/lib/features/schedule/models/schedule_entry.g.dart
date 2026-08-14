// GENERATED CODE - DO NOT MODIFY BY HAND
// الملف يُولّد تلقائياً بواسطة build_runner
// لإعادة التوليد: flutter pub run build_runner build

part of 'schedule_entry.dart';

class ScheduleEntryAdapter extends TypeAdapter<ScheduleEntry> {
  @override
  final int typeId = 0;

  @override
  ScheduleEntry read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return ScheduleEntry(
      id: fields[0] as String,
      day: fields[1] as String,
      subject: fields[2] as String,
      subjectCode: fields[3] as String,
      lecturer: fields[4] as String,
      room: fields[5] as String,
      timeStart: fields[6] as String,
      timeEnd: fields[7] as String,
      isOverridden: fields[8] as bool,
      overrideNote: fields[9] as String?,
      cachedAt: fields[10] as DateTime,
      major: fields[11] as String,
      level: fields[12] as String,
      group: fields[13] as String,
    );
  }

  @override
  void write(BinaryWriter writer, ScheduleEntry obj) {
    writer
      ..writeByte(14)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.day)
      ..writeByte(2)
      ..write(obj.subject)
      ..writeByte(3)
      ..write(obj.subjectCode)
      ..writeByte(4)
      ..write(obj.lecturer)
      ..writeByte(5)
      ..write(obj.room)
      ..writeByte(6)
      ..write(obj.timeStart)
      ..writeByte(7)
      ..write(obj.timeEnd)
      ..writeByte(8)
      ..write(obj.isOverridden)
      ..writeByte(9)
      ..write(obj.overrideNote)
      ..writeByte(10)
      ..write(obj.cachedAt)
      ..writeByte(11)
      ..write(obj.major)
      ..writeByte(12)
      ..write(obj.level)
      ..writeByte(13)
      ..write(obj.group);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ScheduleEntryAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
