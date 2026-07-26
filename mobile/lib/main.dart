import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'home_tab.dart';
import 'schedule_tab.dart';
import 'tasks_tab.dart';
import 'forum_tab.dart';
import 'profile_tab.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ManarScheduleApp());
}

class ManarScheduleApp extends StatefulWidget {
  const ManarScheduleApp({super.key});

  @override
  State<ManarScheduleApp> createState() => _ManarScheduleAppState();
}

class _ManarScheduleAppState extends State<ManarScheduleApp> {
  bool _isDark = true;
  Color _accentColor = const Color(0xFF84CC16);

  void _toggleTheme() {
    setState(() {
      _isDark = !_isDark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'نظام جداول كلية المنار',
      debugShowCheckedModeBanner: false,
      themeMode: _isDark ? ThemeMode.dark : ThemeMode.light,
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF070B13),
        primaryColor: _accentColor,
        colorScheme: ColorScheme.dark(
          primary: _accentColor,
          surface: const Color(0xFF0E1626),
        ),
        textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme),
      ),
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        primaryColor: _accentColor,
        colorScheme: ColorScheme.light(
          primary: _accentColor,
          surface: Colors.white,
        ),
        textTheme: GoogleFonts.cairoTextTheme(ThemeData.light().textTheme),
      ),
      home: MainNavigationScreen(
        isDark: _isDark,
        onToggleTheme: _toggleTheme,
        accentColor: _accentColor,
      ),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  final bool isDark;
  final VoidCallback onToggleTheme;
  final Color accentColor;

  const MainNavigationScreen({
    super.key,
    required this.isDark,
    required this.onToggleTheme,
    required this.accentColor,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  String _studentName = 'طالب منار';
  String _department = 'هندسة البرمجيات';
  String _level = 'المستوى الثالث';
  String _group = 'الشعبة A';
  int _xp = 420;
  int _streak = 7;

  final List<Map<String, dynamic>> _schedules = [
    {
      'id': '1',
      'day': 'SUNDAY',
      'subject': 'هندسة البرمجيات 2',
      'code': 'SE 301',
      'lecturer': 'د. محمد غالب العصيمي',
      'room': 'قاعة 102',
      'time': '08:00 - 10:00',
      'isOverridden': false,
    },
    {
      'id': '2',
      'day': 'SUNDAY',
      'subject': 'قواعد البيانات المتقدمة',
      'code': 'CS 305',
      'lecturer': 'د. أحمد السقاف',
      'room': 'معمل الحاسوب 3',
      'time': '10:15 - 12:15',
      'isOverridden': true,
    },
    {
      'id': '3',
      'day': 'MONDAY',
      'subject': 'الذكاء الاصطناعي',
      'code': 'AI 402',
      'lecturer': 'د. خالد الفتني',
      'room': 'مدرج ابن الهيثم',
      'time': '09:00 - 11:00',
      'isOverridden': false,
    },
    {
      'id': '4',
      'day': 'TUESDAY',
      'subject': 'شبكات الحاسوب',
      'code': 'NET 201',
      'lecturer': 'د. ياسر العريقي',
      'room': 'قاعة 204',
      'time': '11:00 - 01:00',
      'isOverridden': false,
    },
    {
      'id': '5',
      'day': 'WEDNESDAY',
      'subject': 'برمجة الهواتف الذكية (Flutter)',
      'code': 'MOB 303',
      'lecturer': 'م. محمد العصيمي',
      'room': 'معمل البرمجة',
      'time': '08:00 - 11:00',
      'isOverridden': true,
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadSavedData();
  }

  Future<void> _loadSavedData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _studentName = prefs.getString('student_name') ?? _studentName;
      _department = prefs.getString('student_dept') ?? _department;
      _level = prefs.getString('student_level') ?? _level;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      HomeTabWidget(
        studentName: _studentName,
        department: _department,
        level: _level,
        group: _group,
        xp: _xp,
        streak: _streak,
        schedules: _schedules,
        accentColor: widget.accentColor,
        onNavigateTab: (index) => setState(() => _currentIndex = index),
      ),
      ScheduleTabWidget(
        schedules: _schedules,
        accentColor: widget.accentColor,
      ),
      TasksTabWidget(accentColor: widget.accentColor),
      ForumTabWidget(accentColor: widget.accentColor),
      ProfileTabWidget(
        studentName: _studentName,
        department: _department,
        level: _level,
        group: _group,
        isDark: widget.isDark,
        onToggleTheme: widget.onToggleTheme,
        accentColor: widget.accentColor,
        onSaveProfile: (name, dept, level) async {
          setState(() {
            _studentName = name;
            _department = dept;
            _level = level;
          });
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('student_name', name);
          await prefs.setString('student_dept', dept);
          await prefs.setString('student_level', level);
        },
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        backgroundColor: widget.isDark ? const Color(0xFF0E1626) : Colors.white,
        elevation: 0,
        centerTitle: false,
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: widget.accentColor.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: widget.accentColor.withOpacity(0.3)),
              ),
              child: Icon(Icons.school, color: widget.accentColor, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'نظام جداول منار الذكي',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: widget.isDark ? Colors.white : Colors.black87,
                  ),
                ),
                Text(
                  'تطبيق أندرويد فلاتر ⚡',
                  style: TextStyle(
                    fontSize: 10,
                    color: widget.accentColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              widget.isDark ? Icons.light_mode : Icons.dark_mode,
              color: widget.accentColor,
            ),
            onPressed: widget.onToggleTheme,
            tooltip: 'تغيير المظهر',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: pages[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF0E1626) : Colors.white,
          border: Border(
            top: BorderSide(
              color: widget.isDark ? Colors.white10 : Colors.black12,
            ),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          backgroundColor: Colors.transparent,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: widget.accentColor,
          unselectedItemColor: widget.isDark ? Colors.white38 : Colors.black38,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'الرئيسية',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined),
              activeIcon: Icon(Icons.calendar_today),
              label: 'الجدول',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.task_alt),
              activeIcon: Icon(Icons.task),
              label: 'المهام',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.forum_outlined),
              activeIcon: Icon(Icons.forum),
              label: 'الملتقى',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'حسابي',
            ),
          ],
        ),
      ),
    );
  }
}
