import 'package:flutter/material.dart';

class ForumTabWidget extends StatelessWidget {
  final Color accentColor;
  const ForumTabWidget({super.key, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    final List<Map<String, String>> posts = [
      {
        'author': 'محمد العصيمي',
        'time': 'منذ 10 دقائق',
        'title': 'تنويه بخصوص ملخص المحاضرة الثالثة',
        'content': 'تم رفع ملخص محاضرة الذكاء الاصطناعي على قنوات المكتبة الرقمية.',
      },
      {
        'author': 'أحمد خالد',
        'time': 'منذ ساعة',
        'title': 'استفسار عن موعد التكليف الأول',
        'content': 'هل التسليم يوم الأحد القادم أم تم تمديده إلى يوم الثلاثاء؟',
      },
    ];

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ملتقى ومناقشات الشعبة',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: posts.length,
              itemBuilder: (context, index) {
                final p = posts[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0E1626),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            p['author']!,
                            style: TextStyle(color: accentColor, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          Text(
                            p['time']!,
                            style: const TextStyle(color: Colors.white38, fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        p['title']!,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        p['content']!,
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
