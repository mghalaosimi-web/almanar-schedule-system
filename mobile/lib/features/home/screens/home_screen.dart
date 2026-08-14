import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/connectivity_service.dart';
import '../../auth/models/user_model.dart';
import '../../auth/services/auth_service.dart';
import '../../schedule/models/schedule_entry.dart';
import '../../schedule/services/schedule_service.dart';
import '../../schedule/widgets/schedule_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<ScheduleEntry> _todayEntries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadToday();
  }

  Future<void> _loadToday() async {
    final conn = context.read<ConnectivityService>();
    final svc = context.read<ScheduleService>();
    final result = await svc.getSchedule(isConnected: conn.isConnected);

    final today = _todayKey();
    if (mounted) {
      setState(() {
        _todayEntries = result.entries.where((e) => e.day == today).toList()
          ..sort((a, b) => a.timeStart.compareTo(b.timeStart));
        _loading = false;
      });
    }
  }

  static String _todayKey() {
    const map = {1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 6: 'SATURDAY', 7: 'SUNDAY'};
    return map[DateTime.now().weekday] ?? 'SUNDAY';
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;
    final isConnected = context.watch<ConnectivityService>().isConnected;

    return Scaffold(
      backgroundColor: AppColors.darkBg,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          _buildSliverHeader(user, isConnected),
          SliverToBoxAdapter(child: _buildQuickStats(user)),
          SliverToBoxAdapter(child: _buildTodaySection()),
          if (_loading) SliverToBoxAdapter(child: _buildLoadingCards()),
          if (!_loading && _todayEntries.isEmpty) SliverToBoxAdapter(child: _buildNoClassesToday()),
          if (!_loading)
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => ScheduleCard(entry: _todayEntries[i], index: i),
                  childCount: _todayEntries.length,
                ),
              ),
            ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 32)),
        ],
      ),
    );
  }

  // ── Sliver App Bar ──────────────────────────────────────────────
  Widget _buildSliverHeader(UserModel? user, bool isConnected) {
    return SliverAppBar(
      expandedHeight: 180,
      floating: false,
      pinned: true,
      backgroundColor: AppColors.cardBg,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.cardBg, AppColors.darkBg],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          padding: const EdgeInsets.fromLTRB(24, 60, 24, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Row(
                children: [
                  // Avatar
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.accentSubtle,
                      border: Border.all(color: AppColors.accent.withOpacity(0.4), width: 2),
                    ),
                    child: const Icon(Icons.person_rounded, color: AppColors.accent, size: 26),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'مرحباً، ${user?.name ?? 'طالب منار'} 👋',
                          style: AppTextStyles.headlineMedium,
                        ),
                        Text(
                          '${user?.major ?? ''} — ${user?.level != null ? 'المستوى ${user!.level}' : ''}',
                          style: AppTextStyles.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  // Online/Offline indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: isConnected
                          ? AppColors.success.withOpacity(0.15)
                          : AppColors.offline.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: (isConnected ? AppColors.success : AppColors.offline)
                            .withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isConnected ? AppColors.success : AppColors.offline,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          isConnected ? 'متصل' : 'أوفلاين',
                          style: AppTextStyles.labelSmall.copyWith(
                            color: isConnected ? AppColors.success : AppColors.offline,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Quick Stats ─────────────────────────────────────────────────
  Widget _buildQuickStats(UserModel? user) {
    final stats = [
      (_todayEntries.length.toString(), 'محاضرات اليوم', Icons.today_rounded, AppColors.accent),
      (user?.group ?? '-', 'الشعبة', Icons.group_rounded, AppColors.studentColor),
      (user?.level ?? '-', 'المستوى', Icons.stairs_rounded, AppColors.representativeColor),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        children: stats.asMap().entries.map((e) {
          final (value, label, icon, color) = e.value;
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: e.key < 2 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
              decoration: BoxDecoration(
                color: color.withOpacity(0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: color.withOpacity(0.2)),
              ),
              child: Column(
                children: [
                  Icon(icon, color: color, size: 22),
                  const SizedBox(height: 6),
                  Text(value,
                      style: AppTextStyles.headlineMedium
                          .copyWith(color: color, fontSize: 18)),
                  Text(label, style: AppTextStyles.labelSmall),
                ],
              ),
            )
                .animate()
                .fadeIn(delay: (100 * e.key).ms, duration: 400.ms)
                .slideY(begin: 0.3, duration: 350.ms),
          );
        }).toList(),
      ),
    );
  }

  // ── Today Section ───────────────────────────────────────────────
  Widget _buildTodaySection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
      child: Row(
        children: [
          Container(
            width: 3,
            height: 20,
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 10),
          Text('محاضرات اليوم', style: AppTextStyles.headlineSmall),
          const Spacer(),
          if (_loading)
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: AppColors.accent),
            ),
        ],
      ),
    );
  }

  Widget _buildLoadingCards() {
    return Column(
      children: List.generate(3, (i) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        height: 110,
        decoration: BoxDecoration(
          color: AppColors.cardBg, borderRadius: BorderRadius.circular(20),
        ),
      ).animate(onPlay: (c) => c.repeat())
          .shimmer(duration: 1200.ms, color: AppColors.glassBorder, delay: (i * 100).ms)),
    );
  }

  Widget _buildNoClassesToday() {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.celebration_rounded, color: AppColors.accent, size: 48),
            const SizedBox(height: 12),
            Text('لا محاضرات اليوم! 🎉', style: AppTextStyles.headlineSmall),
            const SizedBox(height: 6),
            Text('استمتع بوقت حر', style: AppTextStyles.bodyMedium),
          ],
        ),
      ).animate().fadeIn(delay: 300.ms).scale(),
    );
  }
}
