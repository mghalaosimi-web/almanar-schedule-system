const express = require('express');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Helper: AI Quiz Fallback Generator when Gemini API is unavailable or offline
function generateFallbackQuiz(subjectName, count = 5) {
  const templates = [
    {
      question: `ما هو المفهوم الأساسي لموضوع الدراسات العليا في مقرر ${subjectName}؟`,
      options: [
        'تحليل الهياكل وتصميم الأنظمة الكفاءية',
        'الحفظ الصم بدون فهم آليات العمل',
        'تجاهل معايير الجودة والأداء الفعلي',
        'الاعتماد الكلي على المتغيرات النمطية فقط'
      ],
      correctAnswer: 0,
      explanation: `في مقرر ${subjectName}، يُركز الفهم العلمي على تحليل البيانات وتنسيق الهياكل لضمان الجودة.`
    },
    {
      question: `عند العمل على التكليف أو المشروع الخاص بـ ${subjectName}، ما هي أفضل ممارسة؟`,
      options: [
        'توزيع المهام ومراجعة الشروط الأكاديمية بدقة',
        'التأخير حتى الساعات الأخيرة قبل موعد التسليم',
        'تجاهل التوجيهات المرفقة من المحاضر',
        'عدم التنسيق مع شعبة الدراسة'
      ],
      correctAnswer: 0,
      explanation: 'التخطيط المسبق والمراجعة المبكرة تضمن الحصول على الدرجة الكاملة والتقييم العالي.'
    },
    {
      question: `ما الهدف الرئيسي من حضور المحاضرات العملية والتطبيقية لمادة ${subjectName}؟`,
      options: [
        'تطبيق المفاهيم النظرية حركياً وبرمجياً في القاعة',
        'م مجرد تسجيل الحضور والغياب دون تفاعل',
        'تكرار الملاحظات السابقة بدون تجربة',
        'إلغاء التفاعل المباشر مع الأكاديمي'
      ],
      correctAnswer: 0,
      explanation: 'المحاضرات التطبيقية تهدف لربط المادة النظري بالواقع العملي والمهاري.'
    },
    {
      question: `كيف يتم احتساب نسبة الجاهزية للاختبار النهائي في ${subjectName}؟`,
      options: [
        'بناءً على نسبة الحضور + التكاليف المنجزة + حل الاختبارات التجريبية',
        'بناءً على نسبة الغياب فقط',
        'بالاعتماد على التوقع العشوائي للدرجات',
        'بدون أي معايير دراسية'
      ],
      correctAnswer: 0,
      explanation: 'نظام الكلية يحسب الجاهزية التراكمية من الحضور الفعلي وحل شيتات التكاليف.'
    },
    {
      question: `أي مما يلي يُعد من الاستراتيجيات الفعالة للاستعداد لاختبار ${subjectName}؟`,
      options: [
        'مراجعة ملخصات الملتقى وحل الكويزات الذكية بانتظام',
        'مراجعة المادة ليلة الامتحان فقط دون تحضير',
        'ترك الأسئلة الصعبة بدون مراجعة المحاضر',
        'عدم الاستفادة من مراجع الشعبة'
      ],
      correctAnswer: 0,
      explanation: 'الاستمرار اليومي والمتابعة الدوري تزيد التذكر وتضمن التفوق الأكاديمي.'
    }
  ];

  return templates.slice(0, count);
}

// 1. GET /api/student/readiness - Calculate Exam Readiness Score per subject
router.get('/student/readiness', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Student access required.' });
    }

    const studentId = req.user.id;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { group: true }
    });

    if (!student || !student.groupId) {
      return res.status(200).json({ success: true, data: { overallReadiness: 100, subjectScores: [] } });
    }

    // Fetch student's schedules & subjects
    const schedules = await prisma.schedule.findMany({
      where: { groupId: student.groupId },
      include: { subject: true }
    });

    const uniqueSubjects = [];
    const seenSubjects = new Set();
    schedules.forEach(s => {
      if (s.subject && !seenSubjects.has(s.subject.id)) {
        seenSubjects.add(s.subject.id);
        uniqueSubjects.push(s.subject);
      }
    });

    // Fetch attendance records
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: { studentId }
    });

    // Fetch goal completions by student
    const completions = await prisma.studentGoalCompletion.findMany({
      where: { studentId }
    });
    const completedGoalIds = new Set(completions.map(c => c.academicGoalId));

    // Fetch all goals assigned to the group
    const allGoals = await prisma.academicGoal.findMany({
      where: { groupId: student.groupId }
    });

    const subjectScores = uniqueSubjects.map(sub => {
      // 1. Attendance factor (40%)
      const subSchedules = schedules.filter(s => s.subjectId === sub.id);
      const subScheduleIds = new Set(subSchedules.map(s => s.id));
      const subAtt = attendanceRecords.filter(a => subScheduleIds.has(a.scheduleId));
      const totalAtt = subAtt.length;
      const presentAtt = subAtt.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attRate = totalAtt > 0 ? (presentAtt / totalAtt) : 1; // default to 100% if no sessions yet

      // 2. Goal completion factor (60%)
      const subGoals = allGoals.filter(g => g.subjectId === sub.id);
      const totalGoals = subGoals.length;
      const completedGoals = subGoals.filter(g => completedGoalIds.has(g.id)).length;
      const goalRate = totalGoals > 0 ? (completedGoals / totalGoals) : 1; // default 100% if no goals assigned

      // Score computation
      const readinessScore = Math.round((attRate * 40) + (goalRate * 60));

      let status = 'EXCELLENT'; // EXCELLENT, GOOD, WARN, CRITICAL
      let recommendation = 'ممتاز! واصل على هذا المستوى التراكمي العالي.';
      if (readinessScore < 50) {
        status = 'CRITICAL';
        recommendation = 'حالة حرجة! يرجى مراجعة التكاليف المعلقة وحضور المحاضرات القادمة فوراً.';
      } else if (readinessScore < 75) {
        status = 'WARN';
        recommendation = 'تحذير: لديك تكاليف معلقة ومحاضرات فائتة. قم بإنهاء التكاليف لرفع الجاهزية.';
      } else if (readinessScore < 90) {
        status = 'GOOD';
        recommendation = 'جيد جداً! أنجز التكليف القادم للوصول إلى الجاهزية الكاملة 100%.';
      }

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        readinessScore,
        status,
        attendanceRate: Math.round(attRate * 100),
        pendingGoalsCount: totalGoals - completedGoals,
        completedGoalsCount: completedGoals,
        totalGoalsCount: totalGoals,
        recommendation
      };
    });

    const overallReadiness = subjectScores.length > 0
      ? Math.round(subjectScores.reduce((acc, curr) => acc + curr.readinessScore, 0) / subjectScores.length)
      : 100;

    res.status(200).json({
      success: true,
      data: {
        overallReadiness,
        subjectScores
      }
    });
  } catch (error) {
    console.error('[AI Copilot API] Error calculating readiness:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate readiness score.' });
  }
});

// 2. POST /api/student/quiz/generate - Generate AI Practice Quiz
router.post('/student/quiz/generate', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Student access required.' });
    }

    const { subjectId, subjectName } = req.body;
    let targetSubjectName = subjectName || 'المادة الدراسية';

    if (subjectId && !subjectName) {
      const sub = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });
      if (sub) targetSubjectName = sub.name;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let questions = [];

    if (apiKey) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `قم بتوليد 5 أسئلة اختيار من متعدد (MCQs) لاختبار تجريبي للمقرر الجامعي: "${targetSubjectName}".
يجب أن تحتوي كل مصفوفة سؤال على:
- question: نص السؤال باللغة العربية
- options: صفيف من 4 خيارات نصية باللغة العربية
- correctAnswer: رقم مؤشر الخيار الصحيح (من 0 إلى 3)
- explanation: شرح مختصر لسبب الإجابة الصحيحة باللغة العربية

أرجع النتيجة بصيغة JSON array فقط بدون كود مائل أو markdown.
مثال:
[{"question":"...","options":["أ","ب","ج","د"],"correctAnswer":0,"explanation":"..."}]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        questions = JSON.parse(cleanJson);
      } catch (err) {
        console.warn('[Gemini Quiz API] Fallback activated:', err.message);
        questions = generateFallbackQuiz(targetSubjectName, 5);
      }
    } else {
      questions = generateFallbackQuiz(targetSubjectName, 5);
    }

    res.status(200).json({
      success: true,
      subjectName: targetSubjectName,
      questions
    });
  } catch (error) {
    console.error('[AI Copilot API] Error generating quiz:', error);
    res.status(500).json({ success: false, error: 'Failed to generate practice quiz.' });
  }
});

// 3. POST /api/student/copilot/explain - AI Concept Summarizer & Forum Study Assistant
router.post('/student/copilot/explain', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Student access required.' });
    }

    const { topic, subjectName } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Topic is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    let summary = '';

    if (apiKey) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `أنت مساعد أكاديمي لتخاطب الطلاب في كلية المنار الجامعية.
قم بشرح وتلخيص هذا الموضوع الدراسية: "${topic}" التابع لمقرر "${subjectName || 'المادة الأكاديمية'}".
اجعل الشرح من 3 إلى 5 نقاط ذكية ومبسطة باللغة العربية المنسقة، وأضف نصيحة سريعة للاختبارات.`;

        const result = await model.generateContent(prompt);
        summary = result.response.text();
      } catch (err) {
        summary = `💡 **ملخص ذكي لموضوع: ${topic}**\n\n` +
          `1️⃣ **المفهوم الأساسي:** يُعبر هذا الدرس عن القواعد الجوهرية المعتمدة في هذا المقرر.\n` +
          `2️⃣ **التطبيق العملي:** يُنصح بحل التكاليف المرفقة لترسيخ المفاهيم.\n` +
          `3️⃣ **نصيحة الاختبارات:** تكرار الأسئلة النموذجية يضمن الحصول على النسبة العالية.`;
      }
    } else {
      summary = `💡 **ملخص ذكي لموضوع: ${topic}**\n\n` +
        `1️⃣ **المفهوم الأساسي:** يُعبر هذا الدرس عن القواعد الجوهرية المعتمدة في هذا المقرر.\n` +
        `2️⃣ **التطبيق العملي:** يُنصح بحل التكاليف المرفقة لترسيخ المفاهيم.\n` +
        `3️⃣ **نصيحة الاختبارات:** تكرار الأسئلة النموذجية يضمن الحصول على النسبة العالية.`;
    }

    res.status(200).json({
      success: true,
      topic,
      summary
    });
  } catch (error) {
    console.error('[AI Copilot API] Error generating explanation:', error);
    res.status(500).json({ success: false, error: 'Failed to generate study summary.' });
  }
});

module.exports = router;
