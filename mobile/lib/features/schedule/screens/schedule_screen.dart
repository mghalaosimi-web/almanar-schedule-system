import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/utils/connectivity_service.dart';
import '../../../core/widgets/status_badge.dart';
import '../services/schedule_service.dart';
import '../models/schedule_entry.dart';
import '../widgets/day_selector.dart';
import '../widgets/schedule_card.dart';

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  String _selectedDay = _todayKey();
  ScheduleResult? _result;
  bool _isLoading = false;

  static String _todayKey() {
    const map = {
      DateTime.saturday:  'SATURDAY',
      DateTime.sunday:    'SUNDAY',
      DateTime.monday:    'MONDAY',
      DateTime.tuesday:   'TUESDAY',
      DateTime.wednesday: 'WEDNESDAY',
      DateTime.thursday:  'THURSDAY',
    };
    final w = DateTime.now().weekday;
    // إذا الجمعة → اليوم التالي الأحد
    return map[w] ?? 'SUNDAY';
  }

  @override
  void initState() {
    super.initState();
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    setState(() => _isLoading = true);
    final conn = context.read<ConnectivityService>();
    final svc = context.read<ScheduleService>();
    final result = await svc.getSchedule(isConnected: conn.isConnected);
    if (mounted) setState(() { _result = result; _isLoading = false; });
  }

  List<ScheduleEntry> get _dayEntries {
    if (_result == null) return [];
    return _result!.entries
        .where((e) => e.day == _selectedDay)
        .toList()
      ..sort((a, b) => a.timeStart.compareTo(b.timeStart));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.darkBg,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          // ── Cache Status Banner ──────────────────────────────
          if (_result != null && _result!.isFromCache) _buildCacheBanner(),

          // ── Offline Banner ───────────────────────────────────
          const ConnectionStatusBadge(),

          // ── Day Selector ─────────────────────────────────────
          const SizedBox(height: 8),
          DaySelector(
            selectedDay: _selectedDay,
            onDaySelected: (d) => setState(() => _selectedDay = d),
          ),
          const SizedBox(height: 8),

          // ── Schedule List ────────────────────────────────────
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      title: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.accentSubtle,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.accent.withOpacity(0.3)),
            ),
            child: const Icon(Icons.calendar_today_rounded,
                color: AppColors.accent, size: 18),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(AppStrings.schedule, style: AppTextStyles.headlineSmall),
              Consumer<ScheduleService>(
                builder: (_, svc, __) => svc.isSyncing
                    ? Text(AppStrings.syncingSchedule,
                        style: AppTextStyles.bodySmall.copyWith(
                            color: AppColors.accent, fontSize: 10))
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: AppColors.accent),
          onPressed: _loadSchedule,
          tooltip: 'تحديث',
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildCacheBanner() {
    final stale = _result!.isCacheStale;
    final color = stale ? AppColors.warning : AppColors.info;
    final lastUpdated = _result!.cachedAt != null
        ? DateFormat('yyyy/MM/dd – HH:mm').format(_result!.cachedAt!)
        : '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: color.withOpacity(0.08),
      child: Row(
        children: [
          Icon(
            stale ? Icons.warning_amber_rounded : Icons.cloud_done_outlined,
            color: color,
            size: 15,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              stale
                  ? '${AppStrings.cacheStale} — $lastUpdated'
                  : '${AppStrings.cachedAt}: $lastUpdated',
              style: AppTextStyles.bodySmall.copyWith(color: color),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildBody() {
    if (_isLoading && (_result == null || _result!.entries.isEmpty)) {
      return _buildShimmerLoading();
    }

    final entries = _dayEntries;

    if (entries.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.cardBg,
      onRefresh: _loadSchedule,
      child: ListView.builder(
        physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics()),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: entries.length,
        itemBuilder: (context, i) => ScheduleCard(entry: entries[i], index: i),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.accentSubtle,
            ),
            child: const Icon(Icons.event_available_rounded,
                color: AppColors.accent, size: 40),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(end: const Offset(1.05, 1.05), duration: 1800.ms),
          const SizedBox(height: 20),
          Text(AppStrings.noSchedule, style: AppTextStyles.headlineSmall),
          const SizedBox(height: 8),
          Text(AppStrings.noScheduleHint, style: AppTextStyles.bodyMedium),
        ],
      ),
    ).animate().fadeIn(delay: 200.ms, duration: 600.ms);
  }

  Widget _buildShimmerLoading() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: 5,
      itemBuilder: (_, i) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        height: 120,
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(20),
        ),
      )
          .animate(onPlay: (c) => c.repeat())
          .shimmer(
              duration: 1200.ms,
              color: AppColors.glassBorder,
              delay: (i * 100).ms),
    );
  }
}
