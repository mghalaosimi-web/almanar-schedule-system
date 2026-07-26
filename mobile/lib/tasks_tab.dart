import 'package:flutter/material.dart';

class TasksTabWidget extends StatefulWidget {
  final Color accentColor;
  const TasksTabWidget({super.key, required this.accentColor});

  @override
  State<TasksTabWidget> createState() => _TasksTabWidgetState();
}

class _TasksTabWidgetState extends State<TasksTabWidget> {
  final List<Map<String, dynamic>> _tasks = [
    {'id': '1', 'title': 'تسليم مشروع هندسة البرمجيات النهائي', 'completed': false, 'category': 'مشروع'},
    {'id': '2', 'title': 'حل واجب قواعد البيانات الأسبوعي', 'completed': true, 'category': 'واجب'},
    {'id': '3', 'title': 'مراجعة محاضرة الشبكات والـ Subnetting', 'completed': false, 'category': 'مذاكرة'},
  ];

  void _addTask(String title) {
    if (title.trim().isEmpty) return;
    setState(() {
      _tasks.add({
        'id': DateTime.now().toString(),
        'title': title,
        'completed': false,
        'category': 'عام',
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'التكاليف والمهام الدراسية',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              IconButton(
                icon: Icon(Icons.add_circle_outline, color: widget.accentColor),
                onPressed: () {
                  final controller = TextEditingController();
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: const Color(0xFF0E1626),
                      title: const Text('إضافة مهمة جديدة', style: TextStyle(color: Colors.white)),
                      content: TextField(
                        controller: controller,
                        style: const TextStyle(color: Colors.white),
                        decoration: const InputDecoration(
                          hintText: 'عنوان المهمة...',
                          hintStyle: TextStyle(color: Colors.white38),
                        ),
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('إلغاء'),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: widget.accentColor),
                          onPressed: () {
                            _addTask(controller.text);
                            Navigator.pop(ctx);
                          },
                          child: const Text('إضافة', style: TextStyle(color: Colors.black)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: _tasks.length,
              itemBuilder: (context, index) {
                final task = _tasks[index];
                final isDone = task['completed'] == true;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0E1626),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: CheckboxListTile(
                    activeColor: widget.accentColor,
                    checkColor: Colors.black,
                    value: isDone,
                    onChanged: (val) {
                      setState(() {
                        task['completed'] = val;
                      });
                    },
                    title: Text(
                      task['title'],
                      style: TextStyle(
                        color: isDone ? Colors.white38 : Colors.white,
                        decoration: isDone ? TextDecoration.lineThrough : null,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
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
