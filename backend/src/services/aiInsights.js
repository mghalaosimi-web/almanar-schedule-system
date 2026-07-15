const { prisma } = require('../db');
const { GoogleGenAI } = require('@google/generative-ai');

/**
 * Run Gemini AI operational analysis or fall back to programmatic rules.
 */
async function generateOperationalInsights() {
  try {
    // 1. Gather Telemetry Metrics
    const [
      studentCount,
      scheduleCount,
      failedLogins24h,
      totalAuditLogs,
      activeSessionsCount,
      unreadNotifications,
      lastBackupLog
    ] = await Promise.all([
      prisma.student.count(),
      prisma.schedule.count(),
      prisma.sessionLog.count({
        where: {
          status: { startsWith: 'FAILED' },
          loginTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.auditLog.count(),
      prisma.sessionLog.count({
        where: { logoutTime: null, isRevoked: false }
      }),
      prisma.notificationLog.count({
        where: { readAt: null }
      }),
      prisma.auditLog.findFirst({
        where: { action: 'BACKUP_EXPORT' },
        orderBy: { timestamp: 'desc' }
      })
    ]);

    const metrics = {
      studentCount,
      scheduleCount,
      failedLogins24h,
      totalAuditLogs,
      activeSessionsCount,
      unreadNotifications,
      daysSinceLastBackup: lastBackupLog
        ? Math.round((Date.now() - new Date(lastBackupLog.timestamp).getTime()) / (1000 * 60 * 60 * 24))
        : 999
    };

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let rawInsights = [];

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        // Use gemini-2.5-flash as the standard fast operational model
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Analyze these system logs and operational metrics for an academic scheduling application:
- Total Students: ${metrics.studentCount}
- Total Tomorrow/Active Schedules: ${metrics.scheduleCount}
- Failed Login Attempts (Last 24h): ${metrics.failedLogins24h}
- Total System Actions Logged (Audit Trail): ${metrics.totalAuditLogs}
- Active Live Sessions Now: ${metrics.activeSessionsCount}
- Unread Notifications: ${metrics.unreadNotifications}
- Days Since Last Database Backup: ${metrics.daysSinceLastBackup}

Identify exactly 4 actionable insights, classifications, or security/performance risks.
Respond strictly in JSON format as a raw array. No markdown, no wrap. Follow this structure:
[
  {
    "category": "SECURITY" | "PERFORMANCE" | "ENGAGEMENT" | "MAINTENANCE",
    "severity": "INFO" | "WARNING" | "CRITICAL",
    "title": "A short descriptive title in Arabic",
    "body": "Detailed alert body in Arabic explaining the issue and recommendation"
  }
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        rawInsights = JSON.parse(cleanJson);
      } catch (aiErr) {
        console.warn('[AI Service] Gemini request failed, using local fallback analyzer:', aiErr.message);
        rawInsights = runProgrammaticAnalyzer(metrics);
      }
    } else {
      rawInsights = runProgrammaticAnalyzer(metrics);
    }

    // 2. Persist insights into the Database
    const savedInsights = [];
    for (const item of rawInsights) {
      const insight = await prisma.insightLog.create({
        data: {
          category: item.category || 'INFO',
          severity: item.severity || 'INFO',
          title: item.title || 'تنبيه النظام',
          body: item.body || '',
          data: metrics
        }
      });
      savedInsights.push(insight);
    }

    return savedInsights;
  } catch (error) {
    console.error('[AI Service] Operational insights generation failed:', error);
    throw error;
  }
}

/**
 * Fallback analytical rules to generate insights without calling external AI APIs.
 */
function runProgrammaticAnalyzer(m) {
  const list = [];

  // Security Insight
  if (m.failedLogins24h > 10) {
    list.push({
      category: 'SECURITY',
      severity: 'CRITICAL',
      title: 'محاولات دخول فاشلة مشبوهة 🚨',
      body: `تم رصد عدد ${m.failedLogins24h} محاولة تسجيل دخول فاشلة خلال الـ 24 ساعة الماضية. قد يشير هذا إلى محاولات اختراق عشوائي (brute-force). يوصى بمراجعة سجل التدقيق ومراقبة الـ IPs النشطة.`
    });
  } else if (m.failedLogins24h > 3) {
    list.push({
      category: 'SECURITY',
      severity: 'WARNING',
      title: 'نشاط تسجيل دخول غير اعتيادي 🔐',
      body: `يوجد ${m.failedLogins24h} محاولات تسجيل دخول فاشلة اليوم. يرجى تنبيه المشرفين للتأكد من سلامة الحسابات.`
    });
  } else {
    list.push({
      category: 'SECURITY',
      severity: 'INFO',
      title: 'الأمان مستقر ونظيف 🟢',
      body: 'لم يتم رصد أي محاولات دخول فاشلة مشبوهة اليوم. جدار الحماية ومصادقة المستخدمين تعملان بكفاءة تامة.'
    });
  }

  // Maintenance Insight (Backup)
  if (m.daysSinceLastBackup > 7) {
    list.push({
      category: 'MAINTENANCE',
      severity: 'WARNING',
      title: 'تنبيه صيانة: لم يتم عمل نسخة احتياطية 💾',
      body: `مضى أكثر من ${m.daysSinceLastBackup} أيام منذ آخر عملية نسخ احتياطي ناجحة للنظام. يرجى التوجه لمدير النسخ الاحتياطي وتصدير البيانات فوراً لتفادي فقدانها.`
    });
  } else {
    list.push({
      category: 'MAINTENANCE',
      severity: 'INFO',
      title: 'النسخ الاحتياطي في أمان ⏱️',
      body: `تم عمل نسخة احتياطية للمنظومة مؤخراً (${m.daysSinceLastBackup} يوم). حالة التوافر ممتازة.`
    });
  }

  // Performance Insight
  if (m.activeSessionsCount > 30) {
    list.push({
      category: 'PERFORMANCE',
      severity: 'WARNING',
      title: 'ضغط مرتفع على خادم الجلسات ⚡',
      body: `يوجد حالياً ${m.activeSessionsCount} جلسة نشطة على السيرفر. يُنصح بمراقبة استهلاك الذاكرة RAM وزمن استجابة DB.`
    });
  } else {
    list.push({
      category: 'PERFORMANCE',
      severity: 'INFO',
      title: 'أداء السيرفر ممتاز 📊',
      body: `يعمل النظام بـ ${m.activeSessionsCount} جلسة نشطة فقط حالياً. زمن استجابة الاستعلامات ونسب استهلاك الموارد تقع في الحدود المثالية.`
    });
  }

  // Engagement Insight
  if (m.unreadNotifications > 100) {
    list.push({
      category: 'ENGAGEMENT',
      severity: 'WARNING',
      title: 'تراكم إشعارات الطلاب غير المقروءة 📬',
      body: `يوجد ${m.unreadNotifications} إشعار مرسل لم يقم الطلاب بفتحه أو قراءته بعد. قد يشير هذا إلى ضعف التفاعل مع إشعارات PWA أو مشكلة في إيصالات الاستلام.`
    });
  } else {
    list.push({
      category: 'ENGAGEMENT',
      severity: 'INFO',
      title: 'معدل تفاعل الإشعارات طبيعي 📢',
      body: 'الإشعارات تُسلَّم وتقرأ بنسب مقبولة ولا يوجد تراكم في طوابير الانتظار.'
    });
  }

  return list;
}

module.exports = {
  generateOperationalInsights
};
