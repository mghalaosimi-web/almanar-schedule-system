const { prisma } = require('../db');
const { GoogleGenAI } = require('@google/generative-ai');

/**
 * ── 1. PREDICTIVE STUDENT SUCCESS ENGINE ───────────────────────────────────
 * Computes a Predictive Success Index (PSI) (0-100%) for each student based on:
 * - Attendance Rate (60% weight)
 * - Academic Goal Completions (30% weight)
 * - Streak & Activity (10% weight)
 */
async function calculateStudentSuccessIndex({ collegeId, groupId, userScope = {} }) {
  const whereClause = { ...userScope };
  if (collegeId) whereClause.collegeId = parseInt(collegeId);
  if (groupId) whereClause.groupId = parseInt(groupId);

  const students = await prisma.student.findMany({
    where: whereClause,
    include: {
      major: true,
      level: true,
      group: true,
      attendances: { select: { status: true } },
      goalCompletions: true,
      tasks: { select: { completed: true } }
    },
    take: 100
  });

  const totalGoalsAvailable = await prisma.academicGoal.count().catch(() => 1);

  const report = students.map(student => {
    // A. Attendance Component (60%)
    const totalClasses = student.attendances.length;
    const presentClasses = student.attendances.filter(a => a.status === 'PRESENT').length;
    const attRate = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 100;
    const attScore = (attRate / 100) * 60;

    // B. Goal Completion Component (30%)
    const goalsCompleted = student.goalCompletions.length;
    const goalRate = totalGoalsAvailable > 0 ? Math.min(100, (goalsCompleted / totalGoalsAvailable) * 100) : 100;
    const goalScore = (goalRate / 100) * 30;

    // C. Engagement Streak Component (10%)
    const streakScore = Math.min(10, (student.streak || 0) * 1.5);

    // Total Predictive Success Index (PSI)
    const psi = Math.min(100, Math.round(attScore + goalScore + streakScore));

    let status = 'EXCELLENT';
    let statusAr = 'ممتاز ومستقر 🌟';
    let actionRecommendation = 'استمرار النمط الأكاديمي الحالي وتفعيل شارات التفوق.';

    if (psi < 50) {
      status = 'CRITICAL_INTERVENTION_NEEDED';
      statusAr = 'تدخل عاجل مطلوب 🚨';
      actionRecommendation = 'تنبيه المرشد الأكاديمي وإرسال خطة دعم فردية قبل الامتحانات.';
    } else if (psi < 70) {
      status = 'WARNING_AT_RISK';
      statusAr = 'معرض لخطر التعثر ⚠️';
      actionRecommendation = 'يوصى بتوجيه الطالب لجلسات التقوية المفتوحة وحثه على رفع الحضور.';
    } else if (psi < 85) {
      status = 'ON_TRACK';
      statusAr = 'جيد وفي المسار الطبيعي 👍';
      actionRecommendation = 'متابعة دورية منتظمة بدون إجراءات استثنائية.';
    }

    return {
      studentId: student.id,
      studentName: student.name,
      idNumber: student.idNumber || '—',
      majorName: student.major?.name || 'غير محدد',
      levelName: student.level?.name || 'غير محدد',
      groupName: student.group?.name || 'غير محدد',
      psi,
      attendanceRate: Math.round(attRate),
      goalsCompleted,
      streak: student.streak,
      status,
      statusAr,
      actionRecommendation
    };
  });

  return report.sort((a, b) => a.psi - b.psi);
}

/**
 * ── 2. SMART CONFLICT-FREE RESCHEDULE ADVISOR ──────────────────────────────
 * Scans rooms, group timetable, and lecturer availability to find top 3 clash-free slots.
 */
async function recommendOptimalTimeSlots({ collegeId, groupId, lecturerId, durationMinutes = 90 }) {
  const parsedCollegeId = parseInt(collegeId);
  const parsedGroupId = parseInt(groupId);
  const parsedLecturerId = lecturerId ? parseInt(lecturerId) : null;

  // 1. Fetch available rooms in college
  const rooms = await prisma.room.findMany({
    where: { collegeId: parsedCollegeId }
  });

  if (rooms.length === 0) {
    return [];
  }

  // 2. Fetch existing schedule slots for college
  const existingSchedules = await prisma.schedule.findMany({
    where: { collegeId: parsedCollegeId },
    include: { room: true, group: true }
  });

  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
  const TIME_SLOTS = [
    { start: '08:30', end: '10:00' },
    { start: '10:15', end: '11:45' },
    { start: '12:00', end: '13:30' },
    { start: '13:45', end: '15:15' }
  ];

  const recommendations = [];

  for (const day of DAYS) {
    for (const slot of TIME_SLOTS) {
      for (const room of rooms) {
        // Check group collision
        const groupClash = existingSchedules.some(s =>
          s.dayOfWeek === day &&
          s.startTime === slot.start &&
          s.groupId === parsedGroupId
        );

        // Check room collision
        const roomClash = existingSchedules.some(s =>
          s.dayOfWeek === day &&
          s.startTime === slot.start &&
          s.roomId === room.id
        );

        // Check lecturer collision
        const lecturerClash = parsedLecturerId ? existingSchedules.some(s =>
          s.dayOfWeek === day &&
          s.startTime === slot.start &&
          s.lecturerId === parsedLecturerId
        ) : false;

        if (!groupClash && !roomClash && !lecturerClash) {
          recommendations.push({
            dayOfWeek: day,
            startTime: slot.start,
            endTime: slot.end,
            roomId: room.id,
            roomName: room.name,
            capacity: room.capacity,
            suitabilityScore: 95,
            reason: `قاعة ${room.name} خالية ومناسبة للدفعة بدون أي تعارض أوقات.`
          });
        }

        if (recommendations.length >= 3) break;
      }
      if (recommendations.length >= 3) break;
    }
    if (recommendations.length >= 3) break;
  }

  return recommendations;
}

/**
 * ── 3. AUTOMATED AI EXECUTIVE REPORTS ─────────────────────────────────────
 * Generates an executive operational summary report for Deans and Department Heads.
 */
async function generateExecutiveReport({ collegeId }) {
  const parsedCollegeId = collegeId ? parseInt(collegeId) : undefined;
  const whereClause = parsedCollegeId ? { collegeId: parsedCollegeId } : {};

  const [studentCount, scheduleCount, roomCount, attendances] = await Promise.all([
    prisma.student.count({ where: whereClause }),
    prisma.schedule.count({ where: whereClause }),
    prisma.room.count({ where: whereClause }),
    prisma.attendance.findMany({
      where: parsedCollegeId ? { schedule: { collegeId: parsedCollegeId } } : {},
      select: { status: true }
    })
  ]);

  const totalAtt = attendances.length;
  const presentAtt = attendances.filter(a => a.status === 'PRESENT').length;
  const overallRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

  const metrics = {
    studentCount,
    scheduleCount,
    roomCount,
    overallAttendanceRate: overallRate,
    recordedClasses: totalAtt
  };

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `أنت الخبير الأكاديمي ومستشار الذكاء الاصطناعي لمنظومة المنار التابعة للجامعة.
قم بصياغة تقرير تنفيذي موجز ومحترف باللغة العربية موجه لعميد الكلية ورؤساء الأقسام بناءً على البيانات التالية:
- إجمالي عدد الطلاب: ${metrics.studentCount}
- إجمالي المحاضرات في الجدول: ${metrics.scheduleCount}
- عدد القاعات الدراسية: ${metrics.roomCount}
- نسبة الحضور العامة بالكلية: ${metrics.overallAttendanceRate}%
- إجمالي الجلسات المسجلة: ${metrics.recordedClasses}

يجب أن يحتوي التقرير على 3 أقسام محددة:
1. الملخص التنفيذي للأداء (Executive Summary)
2. مؤشرات الجودة واستغلال القاعات (Utilization & Quality)
3. التوصيات الأكاديمية العاجلة (Key Recommendations)

أعد الاستجابة في كائن JSON بصيغة خام بدون markdown:
{
  "summary": "نص الملخص...",
  "utilizationNote": "نص استغلال الموارد...",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        metrics,
        report: parsed,
        source: 'GEMINI_AI'
      };

    } catch (err) {
      console.warn('[AIAdvisor] Gemini executive report failed, using fallback:', err.message);
    }
  }

  // Fallback Programmatic Report
  return {
    metrics,
    report: {
      summary: `تقرير الأداء الأكاديمي للكلية: يبلغ عدد الطلاب المسجلين ${studentCount} طالباً موزعين على ${scheduleCount} حصة دراسية. نسبة صحة الحضور الإجمالية تبلغ ${overallRate}%.`,
      utilizationNote: `تستغل الكلية ${roomCount} قاعة دراسية مع معدل انتظام جيد في تسليم كشوف الحضور.`,
      recommendations: [
        'تعزيز متابعة الطلاب في المواد التي تقل فيها نسبة الحضور عن 75%.',
        'إصدار تنبيهات تذكيرية عبر تطبيق الموبايل قبل بدء المحاضرات.',
        'عمل مراجعة شريحة القاعات لتوزيع الأحمال في أوقات الذروة.'
      ]
    },
    source: 'PROGRAMMATIC_FALLBACK'
  };
}

module.exports = {
  calculateStudentSuccessIndex,
  recommendOptimalTimeSlots,
  generateExecutiveReport
};
