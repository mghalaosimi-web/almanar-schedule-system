import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'features/auth/models/user_model.dart';
import 'features/schedule/models/schedule_entry.dart';
import 'data/local/hive_boxes.dart';
import 'data/remote/api_client.dart';
import 'core/utils/connectivity_service.dart';
import 'core/services/notification_service.dart';
import 'features/auth/services/auth_service.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── System UI ──────────────────────────────────────────────────
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0E1626),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // ── Hive Init ──────────────────────────────────────────────────
  await Hive.initFlutter();

  // تسجيل الـ TypeAdapters
  Hive.registerAdapter(ScheduleEntryAdapter());
  Hive.registerAdapter(UserModelAdapter());

  // فتح الصناديق
  await Hive.openBox<ScheduleEntry>(HiveBoxes.schedules);
  await Hive.openBox<UserModel>(HiveBoxes.currentUser);
  await Hive.openBox(HiveBoxes.settings);
  await Hive.openBox(HiveBoxes.syncQueue);

  // ── Services Init ──────────────────────────────────────────────
  await ApiClient().init();
  await ConnectivityService().init();
  await LocalNotificationService().init();
  await AuthService().init();

  // ── Run App ────────────────────────────────────────────────────
  runApp(ManarApp());
}
