import 'package:flutter/material.dart';

class ScheduleTabWidget extends StatefulWidget {
  final List<Map<String, dynamic>> schedules;
  final Color accentColor;

  const ScheduleTabWidget({
    super.key,
    required this.schedules,
    required this.accentColor,
  });

  @override
  State<ScheduleTabWidget> createState() => _ScheduleTabWidgetState();
}

class _ScheduleTabWidgetState extends State<ScheduleTabWidget> {
  String _selectedDay = 'SUNDAY';

  final List<Map<String, String>> _days = [
    {'key': 'SATURDAY', 'label': 'السبت'},
    {'key': 'SUNDAY', 'label': 'الأحد'},
    {'key': 'MONDAY', 'label': 'الاثنين'},
    {'key': 'TUESDAY', 'label': 'الثلاثاء'},
    {'key': 'WEDNESDAY', 'label': 'الأربعاء'},
    {'key': 'THURSDAY', 'label': 'الخميس'},
  ];

  @override
  Widget build(BuildContext context) {
    final filtered = widget.schedules.where((s) => s['day'] == _selectedDay).toList();

    return Column(
      children: [
        Container(
          height: 50,
          margin: const EdgeInsets.symmetric(vertical: 12),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _days.length,
            itemBuilder: (context, index) {
              final d = _days[index];
              final isSelected = d['key'] == _selectedDay;
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = d['key']!),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? widget.accentColor : const Color(0xFF0E1626),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected ? widget.accentColor : Colors.white10,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      d['label']!,
                      style: TextStyle(
                        color: isSelected ? Colors.black : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.event_available, size: 48, color: Colors.white24),
                      SizedBox(height: 12),
                      Text(
                        'لا توجد محاضرات مجدولة لهذا اليوم',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final s = filtered[index];
                    final isOverridden = s['isOverridden'] == true;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0E1626),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isOverridden
                              ? Colors.amber.withOpacity(0.5)
                              : Colors.white.withOpacity(0.08),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: widget.accentColor.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  s['code'],
                                  style: TextStyle(
                                    color: widget.accentColor,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                              Row(
                                children: [
                                  const Icon(Icons.access_time, size: 14, color: Colors.white54),
                                  const SizedBox(width: 4),
                                  Text(
                                    s['time'],
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            s['subject'],
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                s['lecturer'],
                                style: const TextStyle(color: Colors.white54, fontSize: 12),
                              ),
                              Text(
                                s['room'],
                                style: TextStyle(
                                  color: widget.accentColor,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                          if (isOverridden) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.info_outline, size: 12, color: Colors.amber),
                                  SizedBox(width: 4),
                                  Text(
                                    'تعديل استثنائي مؤقت في الموعد أو القاعة',
                                    style: TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
