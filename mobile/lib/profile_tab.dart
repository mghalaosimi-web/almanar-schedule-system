import 'package:flutter/material.dart';

class ProfileTabWidget extends StatefulWidget {
  final String studentName;
  final String department;
  final String level;
  final String group;
  final bool isDark;
  final VoidCallback onToggleTheme;
  final Color accentColor;
  final Function(String, String, String) onSaveProfile;

  const ProfileTabWidget({
    super.key,
    required this.studentName,
    required this.department,
    required this.level,
    required this.group,
    required this.isDark,
    required this.onToggleTheme,
    required this.accentColor,
    required this.onSaveProfile,
  });

  @override
  State<ProfileTabWidget> createState() => _ProfileTabWidgetState();
}

class _ProfileTabWidgetState extends State<ProfileTabWidget> {
  late TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.studentName);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF020617)],
              ),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: widget.accentColor.withOpacity(0.4)),
              boxShadow: [
                BoxShadow(
                  color: widget.accentColor.withOpacity(0.15),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'كلية المنار الجامعة',
                      style: TextStyle(
                        color: widget.accentColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    const Icon(Icons.badge_outlined, color: Colors.white54),
                  ],
                ),
                const SizedBox(height: 16),
                CircleAvatar(
                  radius: 36,
                  backgroundColor: widget.accentColor.withOpacity(0.2),
                  child: Text(
                    widget.studentName.isNotEmpty ? widget.studentName[0] : 'S',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: widget.accentColor,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  widget.studentName,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.department,
                  style: TextStyle(color: widget.accentColor, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${widget.level} • ${widget.group}',
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0E1626),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'تعديل البيانات الشخصية',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _nameController,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: 'الاسم الكامل',
                    labelStyle: const TextStyle(color: Colors.white54),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.05),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accentColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: () {
                      widget.onSaveProfile(
                        _nameController.text,
                        widget.department,
                        widget.level,
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('تم حفظ البيانات بنجاح!')),
                      );
                    },
                    child: const Text(
                      'حفظ التغييرات',
                      style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
