import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_text_styles.dart';
import 'core/theme/theme_provider.dart';
import 'core/utils/connectivity_service.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/splash_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/home/screens/home_screen.dart';
import 'features/schedule/screens/schedule_screen.dart';
import 'features/schedule/services/schedule_service.dart';
import 'features/profile/screens/profile_screen.dart';
import 'features/representative/screens/attendance_screen.dart';
import 'features/representative/screens/broadcast_screen.dart';
import 'features/representative/screens/override_request_screen.dart';

class ManarApp extends StatelessWidget {
  ManarApp({super.key});

  // ── Router ──────────────────────────────────────────────────────
  late final _router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final auth = context.read<AuthService>();
      final isLoggedIn = auth.isLoggedIn;
      final isSplash = state.matchedLocation == '/splash';
      final isLogin = state.matchedLocation == '/login';
      final isRegister = state.matchedLocation == '/register';

      if (isSplash) return null;
      if (isRegister) return null;
      if (!isLoggedIn && !isLogin) return '/login';
      if (isLoggedIn && isLogin) return '/';
      return null;
    },
    refreshListenable: AuthService(),
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      ShellRoute(
        builder: (context, state, child) => _MainShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/schedule', builder: (_, __) => const ScheduleScreen()),
          GoRoute(path: '/attendance', builder: (_, __) => const AttendanceScreen()),
          GoRoute(path: '/broadcast', builder: (_, __) => const BroadcastScreen()),
          GoRoute(path: '/override-request', builder: (_, __) => const OverrideRequestScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()..init()),
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => ConnectivityService()),
        ChangeNotifierProvider(create: (_) => ScheduleService()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProv, _) {
          return MaterialApp.router(
            title: 'نظام جداول المنار',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: themeProv.themeMode,
            routerConfig: _router,
            builder: (context, child) {
              return child!
                  .animate()
                  .fadeIn(duration: 300.ms);
            },
          );
        },
      ),
    );
  }
}

// ── Main Shell with Bottom Navigation ──────────────────────────────
class _MainShell extends StatelessWidget {
  final Widget child;
  const _MainShell({required this.child});

  int _indexFromLocation(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    if (loc == '/') return 0;
    if (loc.startsWith('/schedule')) return 1;
    if (loc.startsWith('/attendance')) return 2;
    if (loc.startsWith('/broadcast')) return 3;
    if (loc.startsWith('/override-request')) return 4;
    if (loc.startsWith('/profile')) return 5;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;
    final isRep = user?.isRepresentative ?? false;
    final currentIndex = _indexFromLocation(context);

    final tabs = _buildTabs(isRep);

    return Scaffold(
      body: child,
      bottomNavigationBar: _buildBottomNav(context, tabs, currentIndex),
    );
  }

  List<_TabItem> _buildTabs(bool isRep) {
    return [
      const _TabItem('/', 'الرئيسية', Icons.home_outlined, Icons.home_rounded),
      const _TabItem('/schedule', 'الجدول', Icons.calendar_today_outlined, Icons.calendar_today_rounded),
      if (isRep) ...[
        const _TabItem('/attendance', 'الحضور', Icons.how_to_reg_outlined, Icons.how_to_reg_rounded),
        const _TabItem('/broadcast', 'إشعارات', Icons.campaign_outlined, Icons.campaign_rounded),
        const _TabItem('/override-request', 'تعديل', Icons.edit_calendar_outlined, Icons.edit_calendar_rounded),
      ],
      const _TabItem('/profile', 'حسابي', Icons.person_outline_rounded, Icons.person_rounded),
    ];
  }

  Widget _buildBottomNav(
      BuildContext context, List<_TabItem> tabs, int currentIndex) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0x1FFFFFFF) : AppColors.lightBorder,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.06),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: tabs.asMap().entries.map((e) {
              final tab = e.value;
              final isSelected = currentIndex == e.key;
              final activeColor = isDark ? AppColors.accent : AppColors.accentDark;
              final unselectedColor = isDark ? AppColors.textMutedDark : AppColors.textMutedLight;

              return GestureDetector(
                onTap: () => context.go(tab.path),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? activeColor.withValues(alpha: 0.12)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isSelected ? tab.activeIcon : tab.icon,
                        color: isSelected ? activeColor : unselectedColor,
                        size: 22,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        tab.label,
                        style: AppTextStyles.labelSmall.copyWith(
                          color: isSelected ? activeColor : unselectedColor,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final String path;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  const _TabItem(this.path, this.label, this.icon, this.activeIcon);
}
