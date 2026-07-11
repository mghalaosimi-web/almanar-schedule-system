require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Hajjah University configuration
const hajjahCollegesConfig = [
  {
    name: "كلية الطب والعلوم الصحية",
    slug: "medicine-health",
    location: "Hajjah",
    majors: ["الطب البشري", "الرعاية التنفسية", "الصيدلة", "التمريض", "القبالة", "المختبرات", "طب الطوارئ"]
  },
  {
    name: "كلية العلوم التطبيقية",
    slug: "applied-sciences",
    location: "Hajjah",
    majors: ["علوم الحاسوب", "الذكاء الاصطناعي", "تقنية المعلومات IT", "الأمن السيبراني", "الاتصالات والشبكات", "الكيمياء الصناعية", "الجيولوجيا والتعدين", "ميكروبيولوجي"]
  }
];

// Al-Manar University College configuration (strictly 6 majors)
const almanarDeptsData = [
  {
    name: "قسم الهندسة وتكنولوجيا المعلومات",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    name: "قسم العلوم الإدارية والمالية",
    majors: ["إدارة أعمال", "محاسبة"]
  },
  {
    name: "قسم الشريعة والعلوم الصحية",
    majors: ["شريعة وقانون", "إدارة صحية"]
  }
];

// Al-Manar unique rooms from schedules
const almanarRoomsData = [
  { name: 'قاعة (3)', capacity: 60 },
  { name: 'قاعة (5)', capacity: 60 },
  { name: 'قاعة (6)', capacity: 60 },
  { name: 'قاعة (7)', capacity: 60 },
  { name: 'قاعة (8)', capacity: 60 }
];

// Al-Manar unique lecturers from schedules
const almanarLecturerNames = [
  'د. محمد السويدي', 'د. أحمد الظفاري', 'د. ضياء القدسي', 'أ. ساره الحجاجي',
  'أ. أفنان الشرفي', 'د. يحيى العبدلي', 'د. عبد الرزاق الأهدل', 'د. محيي الدين الحاج',
  'د. غفران الدخينة', 'د. لينا مفلح', 'أ. أشجان الدعوي', 'أ. أمل الفتي',
  'أ. جيهان واصل', 'أ. أنهار شمهان', 'د. عبد الخالق الفيل', 'د. فارس الأعور',
  'د. صالح رزق', 'د. ياسين الزريقي', 'د. كمال جسار', 'د. أحمد يعقوب',
  'أ. منصور أبو عادل', 'أ.د. يحيى العشبي', 'م. سمر بدر', 'د. عبده شويه',
  'د. شفيق القرشي', 'د. بكر القشوي', 'د. أسماء شمسان', 'د. بسمه القباطي'
];

// Clean lecturer name to ignore titles 'د.' or 'أ.' or 'أ.د.' or 'م.'
function cleanName(name) {
  if (!name) return '';
  return name.replace(/^(د\.|أ\.|أ\.د\.|م\.)\s*/, '').trim();
}

// Convert Arabic name to safe English email prefix
function getLecturerEmailPrefix(name) {
  const mapping = {
    'د. محمد السويدي': 'm.suwaidi',
    'د. أحمد الظفاري': 'a.dhofari',
    'د. ضياء القدسي': 'd.qudsi',
    'أ. ساره الحجاجي': 's.hajjaji',
    'أ. أفنان الشرفي': 'a.sharafi',
    'د. يحيى العبدلي': 'y.abdali',
    'د. عبد الرزاق الأهدل': 'a.ahdal',
    'د. محيي الدين الحاج': 'm.haj',
    'د. غفران الدخينة': 'g.dukhaina',
    'د. لينا مفلح': 'l.muflih',
    'أ. أشجان الدعوي': 'a.daawi',
    'أ. أمل الفتي': 'a.fiti',
    'أ. جيهان واصل': 'j.wasel',
    'أ. أنهار شمهان': 'a.shamhan',
    'د. عبد الخالق الفيل': 'a.fil',
    'د. فارس الأعور': 'f.awar',
    'د. صالح رزق': 's.rizq',
    'د. ياسين الزريقي': 'y.zuriki',
    'د. كمال جسار': 'k.jassar',
    'د. أحمد يعقوب': 'a.yaqoub',
    'أ. منصور أبو عادل': 'm.abuadel',
    'أ.د. يحيى العشبي': 'y.ashbi',
    'م. سمر بدر': 's.badr',
    'د. عبده شويه': 'a.shwiah',
    'د. شفيق القرشي': 's.qurashi',
    'د. بكر القشوي': 'b.qashwi',
    'د. أسماء شمسان': 'a.shamsan',
    'د. بسمه القباطي': 'b.qubati'
  };
  return mapping[name] || 'lecturer.' + Math.random().toString(36).substring(2, 7);
}

// Al-Manar schedule entries from Level 2, Level 3, and Level 4 images
const almanarSchedulesData = [
  // ── LEVEL 2 ─────────────────────────────────────────────────────────────
  {
    levelName: "Level 2",
    day: "SATURDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "مهارات الاتصال",
    lecturerName: "د. محمد السويدي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني", "إدارة أعمال", "إدارة صحية", "محاسبة"]
  },
  {
    levelName: "Level 2",
    day: "SATURDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (6)",
    subjectName: "التشريع الجنائي الإسلامي",
    lecturerName: "د. أحمد الظفاري",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "SATURDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (5)",
    subjectName: "البرمجة كائنية التوجيه",
    lecturerName: "د. ضياء القدسي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "SATURDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (8)",
    subjectName: "مبادئ شبكات الحاسوب (1)",
    lecturerName: "د. ضياء القدسي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "SUNDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (8)",
    subjectName: "معمارية وتنظيم الحاسوب",
    lecturerName: "أ. ساره الحجاجي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "SUNDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "أحكام المعاملات",
    lecturerName: "د. أحمد يعقوب",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "تصميم الويب",
    lecturerName: "أ. أفنان الشرفي",
    majors: ["تقنية المعلومات IT"]
  },
  {
    levelName: "Level 2",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "تقنيات الويب",
    lecturerName: "أ. أفنان الشرفي",
    majors: ["أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (5)",
    subjectName: "إدارة الإنتاج والعمليات",
    lecturerName: "د. يحيى العبدلي",
    majors: ["إدارة أعمال", "إدارة صحية", "محاسبة"]
  },
  {
    levelName: "Level 2",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "قواعد بيانات (1)",
    lecturerName: "د. عبد الرزاق الأهدل",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (6)",
    subjectName: "اقتصاديات نقود وبنوك",
    lecturerName: "د. محيي الدين الحاج",
    majors: ["إدارة أعمال", "محاسبة", "شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "مصطلحات طبية وصحية",
    lecturerName: "د. غفران الدخينة",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 2",
    day: "MONDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "اقتصاديات نقود وبنوك",
    lecturerName: "د. محيي الدين الحاج",
    majors: ["إدارة أعمال", "محاسبة", "شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "مبادئ التسويق",
    lecturerName: "د. لينا مفلح",
    majors: ["إدارة أعمال", "محاسبة"]
  },
  {
    levelName: "Level 2",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "تسويق صحي",
    lecturerName: "د. لينا مفلح",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 2",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "أصول الفقه",
    lecturerName: "د. أحمد الظفاري",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (6)",
    subjectName: "إدارة موارد بشرية",
    lecturerName: "د. لينا مفلح",
    majors: ["إدارة أعمال", "محاسبة", "إدارة صحية"]
  },
  {
    levelName: "Level 2",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "قانون مدني (مصادر الالتزام)",
    lecturerName: "أ. أشجان الدعوي",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "WEDNESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (5)",
    subjectName: "الجبر الخطي",
    lecturerName: "أ. أمل الفتي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 2",
    day: "WEDNESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (6)",
    subjectName: "رياضة مالية",
    lecturerName: "أ. جيهان واصل",
    majors: ["إدارة أعمال", "محاسبة"]
  },
  {
    levelName: "Level 2",
    day: "WEDNESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "إدارة مستشفيات",
    lecturerName: "أ. أنهار شمهان",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 2",
    day: "THURSDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "القانون الدولي العام",
    lecturerName: "د. عبد الخالق الفيل",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "THURSDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "محاسبة شركة أشخاص",
    lecturerName: "د. فارس الأعور",
    majors: ["إدارة أعمال", "محاسبة", "إدارة صحية"]
  },
  {
    levelName: "Level 2",
    day: "THURSDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "قانون إداري",
    lecturerName: "د. عبد الخالق الفيل",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "THURSDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (3)",
    subjectName: "قانون العقوبات العام",
    lecturerName: "د. صالح رزق",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 2",
    day: "THURSDAY",
    startTime: "14:00",
    endTime: "16:00",
    roomName: "قاعة (7)",
    subjectName: "المحاسبة الحكومية والقومية",
    lecturerName: "د. ياسين الزريقي",
    majors: ["إدارة أعمال", "محاسبة"]
  },

  // ── LEVEL 3 ─────────────────────────────────────────────────────────────
  {
    levelName: "Level 3",
    day: "SATURDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "مهارات الاتصال",
    lecturerName: "د. محمد السويدي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "SATURDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (6)",
    subjectName: "إدارة المبيعات",
    lecturerName: "د. محمد السويدي",
    majors: ["إدارة أعمال"]
  },
  {
    levelName: "Level 3",
    day: "SATURDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "المحاسبة الضريبية (1)",
    lecturerName: "د. كمال جسار",
    majors: ["محاسبة"]
  },
  {
    levelName: "Level 3",
    day: "SATURDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "التشريع الجنائي الإسلامي",
    lecturerName: "د. أحمد الظفاري",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "SATURDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (6)",
    subjectName: "إدارة المنشآت المتخصصة",
    lecturerName: "د. محمد السويدي",
    majors: ["إدارة أعمال"]
  },
  {
    levelName: "Level 3",
    day: "SUNDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "التشفير",
    lecturerName: "د. ضياء القدسي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "SUNDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "الإدارة المالية والتمويل",
    lecturerName: "د. يحيى العبدلي",
    majors: ["إدارة أعمال", "محاسبة", "إدارة صحية"]
  },
  {
    levelName: "Level 3",
    day: "SUNDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "أحكام المعاملات",
    lecturerName: "د. أحمد يعقوب",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "أحكام المواريث",
    lecturerName: "د. أحمد يعقوب",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "مصطلحات طبية",
    lecturerName: "د. غفران الدخينة",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 3",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "إدارة المشروعات (ريادة الأعمال)",
    lecturerName: "أ. منصور أبو عادل",
    majors: ["إدارة أعمال"]
  },
  {
    levelName: "Level 3",
    day: "MONDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (5)",
    subjectName: "أمن المعلومات والشبكات",
    lecturerName: "د. عبد الرزاق الأهدل",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "MONDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (6)",
    subjectName: "بحوث العمليات (الأساليب الكمية)",
    lecturerName: "د. عبده شويه",
    majors: ["إدارة أعمال", "محاسبة", "إدارة صحية", "شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "MONDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (5)",
    subjectName: "تحليل التهديدات والثغرات",
    lecturerName: "د. عبد الرزاق الأهدل",
    majors: ["أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "مناهج البحث العلمي",
    lecturerName: "أ.د. يحيى العشبي",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (6)",
    subjectName: "مراسلة باللغة الإنجليزية",
    lecturerName: "د. غفران الدخينة",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 3",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (5)",
    subjectName: "التفاعل بين الإنسان والحاسوب",
    lecturerName: "م. سمر بدر",
    majors: ["تقنية المعلومات IT"]
  },
  {
    levelName: "Level 3",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "محاسبة المنشآت المالية",
    lecturerName: "د. فارس الأعور",
    majors: ["إدارة أعمال", "محاسبة"]
  },
  {
    levelName: "Level 3",
    day: "TUESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "محاسبة المنشآت الصحية",
    lecturerName: "د. فارس الأعور",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 3",
    day: "WEDNESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (8)",
    subjectName: "الذكاء الاصطناعي",
    lecturerName: "د. عبده شويه",
    majors: ["تقنية المعلومات IT", "أمن سيبراني"]
  },
  {
    levelName: "Level 3",
    day: "WEDNESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "الإحصاء الصحي",
    lecturerName: "أ. جيهان واصل",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 3",
    day: "THURSDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (6)",
    subjectName: "قانون مدني (عقود البيع والإيجار)",
    lecturerName: "د. صالح رزق",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "THURSDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (3)",
    subjectName: "قانون المرافعات",
    lecturerName: "د. شفيق القرشي",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "THURSDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (7)",
    subjectName: "محاسبة التكاليف (1)",
    lecturerName: "د. ياسين الزريقي",
    majors: ["محاسبة"]
  },
  {
    levelName: "Level 3",
    day: "THURSDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (6)",
    subjectName: "المنظمات الدولية وحقوق الإنسان",
    lecturerName: "د. عبد الخالق الفيل",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 3",
    day: "THURSDAY",
    startTime: "14:00",
    endTime: "16:00",
    roomName: "قاعة (7)",
    subjectName: "المحاسبة الحكومية والقومية",
    lecturerName: "د. ياسين الزريقي",
    majors: ["إدارة أعمال", "محاسبة"]
  },

  // ── LEVEL 4 ─────────────────────────────────────────────────────────────
  {
    levelName: "Level 4",
    day: "SATURDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (7)",
    subjectName: "دراسة جدوى وتقييم مشاريع",
    lecturerName: "د. يحيى العبدلي",
    majors: ["إدارة أعمال", "إدارة صحية", "محاسبة"]
  },
  {
    levelName: "Level 4",
    day: "SATURDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "قانون الوصية والوقف",
    lecturerName: "د. أحمد يعقوب",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 4",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (6)",
    subjectName: "إدارة الرعاية الصحية",
    lecturerName: "د. بكر القشوي",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 4",
    day: "SUNDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "دراسات محاسبية متخصصة",
    lecturerName: "د. كمال جسار",
    majors: ["محاسبة"]
  },
  {
    levelName: "Level 4",
    day: "MONDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (8)",
    subjectName: "الأعمال الإلكترونية",
    lecturerName: "د. لينا مفلح",
    majors: ["إدارة أعمال"]
  },
  {
    levelName: "Level 4",
    day: "MONDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "تسويق الخدمات الصحية",
    lecturerName: "د. لينا مفلح",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 4",
    day: "TUESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (5)",
    subjectName: "مناهج البحث العلمي",
    lecturerName: "أ.د. يحيى العشبي",
    majors: ["إدارة أعمال", "إدارة صحية", "محاسبة", "شريعة وقانون"]
  },
  {
    levelName: "Level 4",
    day: "WEDNESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (6)",
    subjectName: "إدارة أعمال باللغة الإنجليزية",
    lecturerName: "د. أسماء شمسان",
    majors: ["إدارة أعمال"]
  },
  {
    levelName: "Level 4",
    day: "WEDNESDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (8)",
    subjectName: "مراجعة الحسابات (1)",
    lecturerName: "أ. فارس الأعور",
    majors: ["محاسبة"]
  },
  {
    levelName: "Level 4",
    day: "WEDNESDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "صحة عامة",
    lecturerName: "د. بسمه القباطي",
    majors: ["إدارة صحية"]
  },
  {
    levelName: "Level 4",
    day: "THURSDAY",
    startTime: "08:00",
    endTime: "10:00",
    roomName: "قاعة (3)",
    subjectName: "القانون الدولي الخاص (تنازع القوانين)",
    lecturerName: "د. شفيق القرشي",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 4",
    day: "THURSDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (8)",
    subjectName: "قانون الإجراءات الجزائية",
    lecturerName: "د. صالح رزق",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 4",
    day: "THURSDAY",
    startTime: "10:00",
    endTime: "12:00",
    roomName: "قاعة (7)",
    subjectName: "المحاسبة الإدارية",
    lecturerName: "د. ياسين الزريقي",
    majors: ["إدارة أعمال", "إدارة صحية", "محاسبة"]
  },
  {
    levelName: "Level 4",
    day: "THURSDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (6)",
    subjectName: "قانون التنفيذ الجبري",
    lecturerName: "د. شفيق القرشي",
    majors: ["شريعة وقانون"]
  },
  {
    levelName: "Level 4",
    day: "THURSDAY",
    startTime: "12:00",
    endTime: "14:00",
    roomName: "قاعة (7)",
    subjectName: "محاسبة التكاليف (3)",
    lecturerName: "د. ياسين الزريقي",
    majors: ["محاسبة"]
  }
];

async function main() {
  // Check if database already has data (majors) to prevent wiping existing data
  const majorCount = await prisma.major.count().catch(() => 0);
  if (majorCount > 0) {
    console.log('Database is already seeded and contains data. Skipping seeding to preserve existing records.');
    return;
  }

  console.log('Clearing existing database tables...');
  await prisma.seatAllocation.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.pushSubscription.deleteMany();
  await prisma.scheduleOverride.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.rescheduleRequest.deleteMany();
  await prisma.student.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.examSchedule.deleteMany();
  await prisma.lecturer.deleteMany();
  await prisma.room.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.group.deleteMany();
  await prisma.level.deleteMany();
  await prisma.major.deleteMany();
  await prisma.department.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.college.deleteMany();
  await prisma.university.deleteMany();
  await prisma.governorate.deleteMany();
  console.log('All tables cleared.');

  console.log('Creating Governorates...');
  const targetGovs = ["حجة"];
  const govMap = {};
  for (const name of targetGovs) {
    const gov = await prisma.governorate.create({
      data: { name }
    });
    govMap[name] = gov;
  }

  // Create Levels early so we can associate them with major/level groups
  console.log('Creating Levels...');
  const levels = [];
  const levelsMap = {};
  for (let i = 1; i <= 4; i++) {
    const lvl = await prisma.level.create({ data: { name: `Level ${i}` } });
    levels.push(lvl);
    levelsMap[`Level ${i}`] = lvl;
  }

  console.log('Creating Al-Manar University & College...');
  const almanarUniversity = await prisma.university.create({
    data: {
      name: "كلية المنار الجامعية",
      slug: "almanar-college",
      logoUrl: null,
      themeColor: "#059669",
      governorateId: govMap["حجة"].id
    }
  });

  const almanarCollege = await prisma.college.create({
    data: {
      name: "كلية المنار الجامعية",
      slug: "almanar-main",
      location: "Sanaa",
      universityId: almanarUniversity.id
    }
  });

  console.log('Creating Al-Manar Departments & Majors...');
  const almanarMajorsMap = {};
  const almanarMajorsList = [];
  for (const deptConfig of almanarDeptsData) {
    const dept = await prisma.department.create({
      data: {
        name: deptConfig.name,
        collegeId: almanarCollege.id
      }
    });

    for (const majorName of deptConfig.majors) {
      const major = await prisma.major.create({
        data: {
          name: majorName,
          departmentId: dept.id
        }
      });
      almanarMajorsMap[majorName] = major;
      almanarMajorsList.push(major);
    }
  }

  console.log('Creating Al-Manar Groups for each combination of Major and Level...');
  const almanarGroupsMap = {}; // Key: "majorId_levelId_groupSuffix" -> Group object
  const groupSuffixes = ['مجموعة أ (نظري)', 'مجموعة ب (عملي 1)', 'مجموعة ج (عملي 2)'];
  for (const majorName of Object.keys(almanarMajorsMap)) {
    const major = almanarMajorsMap[majorName];
    for (const lvl of levels) {
      for (const suffix of groupSuffixes) {
        const groupName = `${suffix}`;
        const grp = await prisma.group.create({
          data: {
            name: groupName,
            majorId: major.id,
            levelId: lvl.id,
            collegeId: almanarCollege.id
          }
        });
        almanarGroupsMap[`${major.id}_${lvl.id}_${suffix}`] = grp;
      }
    }
  }

  console.log('Creating Al-Manar Rooms...');
  const almanarRoomsMap = {};
  for (const rm of almanarRoomsData) {
    const createdRoom = await prisma.room.create({
      data: {
        name: rm.name,
        capacity: rm.capacity,
        collegeId: almanarCollege.id
      }
    });
    almanarRoomsMap[rm.name] = createdRoom;
  }

  console.log('Creating Al-Manar Lecturers...');
  const lecturerPasswordHash = await bcrypt.hash('12345678', 10);
  const almanarLecturersMap = {};
  for (const name of almanarLecturerNames) {
    const emailPrefix = getLecturerEmailPrefix(name);
    const email = `${emailPrefix}@manar.edu`;
    const lecturer = await prisma.lecturer.create({
      data: {
        name,
        email,
        password: lecturerPasswordHash,
        phone: `+96773` + String(Math.floor(1000000 + Math.random() * 9000000)),
        collegeId: almanarCollege.id
      }
    });
    almanarLecturersMap[cleanName(name)] = lecturer;
  }

  console.log('Creating Al-Manar Subjects & Schedules...');
  const almanarSubjectsMap = {};
  let subjectIdx = 1;
  const schedulesToCreate = [];

  for (const item of almanarSchedulesData) {
    // 1. Get or create subject
    let subject = almanarSubjectsMap[item.subjectName];
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          name: item.subjectName,
          code: `M-SUB-${subjectIdx++}`,
          type: 'THEORY',
          collegeId: almanarCollege.id
        }
      });
      almanarSubjectsMap[item.subjectName] = subject;
    }

    // 2. Resolve room
    const room = almanarRoomsMap[item.roomName];
    if (!room) {
      console.warn(`Room ${item.roomName} not found!`);
      continue;
    }

    // 3. Resolve lecturer using cleaned name to prevent أ. vs د. title conflicts
    const lecturer = almanarLecturersMap[cleanName(item.lecturerName)];
    if (!lecturer) {
      console.warn(`Lecturer ${item.lecturerName} (cleaned: ${cleanName(item.lecturerName)}) not found!`);
    }

    // 4. Resolve level
    const level = levelsMap[item.levelName];
    if (!level) continue;

    // 5. Link schedule to each major's group for this level
    for (const majorName of item.majors) {
      const major = almanarMajorsMap[majorName];
      if (!major) continue;

      const group = almanarGroupsMap[`${major.id}_${level.id}_مجموعة أ (نظري)`];
      if (!group) continue;

      schedulesToCreate.push({
        subjectId: subject.id,
        roomId: room.id,
        lecturerName: item.lecturerName,
        lecturerId: lecturer ? lecturer.id : null,
        groupId: group.id,
        dayOfWeek: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
        collegeId: almanarCollege.id
      });
    }
  }

  await prisma.schedule.createMany({ data: schedulesToCreate });
  console.log(`Seeded ${schedulesToCreate.length} schedules for Al-Manar.`);


  // Seeding Hajjah University Colleges & details
  console.log('Creating Hajjah University Colleges, Departments, and Majors...');
  const hajjahUniversity = await prisma.university.create({
    data: {
      name: "جامعة حجة",
      slug: "hajjah-university",
      logoUrl: "/hajjah-logo.png",
      themeColor: "#1e3a8a",
      governorateId: govMap["حجة"].id
    }
  });

  const createdHajjahColleges = [];
  const hajjahMajorsList = [];
  for (const config of hajjahCollegesConfig) {
    const college = await prisma.college.create({
      data: {
        name: config.name,
        slug: config.slug,
        location: config.location,
        universityId: hajjahUniversity.id
      }
    });
    createdHajjahColleges.push(college);

    const dept = await prisma.department.create({
      data: {
        name: college.name,
        collegeId: college.id
      }
    });

    for (const majorName of config.majors) {
      const major = await prisma.major.create({
        data: {
          name: majorName,
          departmentId: dept.id
        }
      });
      hajjahMajorsList.push({ ...major, collegeId: college.id });
    }
  }

  const hajjahAppliedCollege = createdHajjahColleges.find(c => c.slug === 'applied-sciences') || createdHajjahColleges[0];

  // Hajjah Groups (general list for compatibility)
  const hajjahGroupsList = [];
  const hajjahGroupNames = ['مجموعة أ (نظري)', 'مجموعة ب (عملي 1)', 'مجموعة ج (عملي 2)'];
  for (const gName of hajjahGroupNames) {
    const grp = await prisma.group.create({ data: { name: gName, collegeId: hajjahAppliedCollege.id } });
    hajjahGroupsList.push(grp);
  }

  // Hajjah Rooms
  const hajjahRoomsData = [
    { name: 'قاعة 1', capacity: 45 },
    { name: 'قاعة 2', capacity: 45 },
    { name: 'مختبر الحاسوب 1', capacity: 30 }
  ];
  const hajjahRooms = [];
  for (const rData of hajjahRoomsData) {
    const rm = await prisma.room.create({
      data: { name: rData.name, capacity: rData.capacity, collegeId: hajjahAppliedCollege.id }
    });
    hajjahRooms.push(rm);
  }

  // Hajjah Lecturers
  const hajjahLecturerNames = ['أ. افنان الشرفي', 'د. عبد الرزاق الأهدل', 'أ. سبأ زمام'];
  const hajjahLecturersMap = {};
  for (let idx = 0; idx < hajjahLecturerNames.length; idx++) {
    const name = hajjahLecturerNames[idx];
    const lecturer = await prisma.lecturer.create({
      data: {
        name,
        email: `lecturer.hajjah.${idx + 1}@manar.edu`,
        password: lecturerPasswordHash,
        phone: `+9677800000${idx + 1}`,
        collegeId: hajjahAppliedCollege.id
      }
    });
    hajjahLecturersMap[name] = lecturer;
  }

  // Hajjah Subjects
  const hajjahSubjects = [
    { name: 'تصميم مواقع الويب', code: 'H-IT-WEB', type: 'THEORY' },
    { name: 'البرمجة المرئية', code: 'H-IT-VISUAL', type: 'THEORY' }
  ];
  const hajjahSubjectsMap = {};
  for (const sub of hajjahSubjects) {
    const s = await prisma.subject.create({
      data: { name: sub.name, code: sub.code, type: sub.type, collegeId: hajjahAppliedCollege.id }
    });
    hajjahSubjectsMap[sub.name] = s;
  }

  // Hajjah Schedules
  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayDayName = daysOfWeek[new Date().getDay()];
  const hajjahSchedules = [
    { subjectName: 'تصميم مواقع الويب', lecturer: 'أ. افنان الشرفي', roomName: 'قاعة 1', day: todayDayName, startTime: '08:00', endTime: '10:00', groupName: 'مجموعة أ (نظري)' }
  ];
  for (const item of hajjahSchedules) {
    const room = hajjahRooms.find(r => r.name === item.roomName);
    const subject = hajjahSubjectsMap[item.subjectName];
    const lecturer = hajjahLecturersMap[item.lecturer];
    const group = hajjahGroupsList.find(g => g.name === item.groupName);
    if (room && subject && group) {
      await prisma.schedule.create({
        data: {
          subjectId: subject.id,
          roomId: room.id,
          lecturerName: item.lecturer,
          lecturerId: lecturer ? lecturer.id : null,
          groupId: group.id,
          dayOfWeek: item.day,
          startTime: item.startTime,
          endTime: item.endTime,
          collegeId: hajjahAppliedCollege.id
        }
      });
    }
  }


  // Seeding Health Institute (المعهد الصحي)
  console.log('Creating Health Institute (المعهد الصحي) University & College...');
  const healthUniversity = await prisma.university.create({
    data: {
      name: "المعهد الصحي",
      slug: "health-institute",
      logoUrl: "/health-logo.png",
      themeColor: "#0ea5e9",
      governorateId: govMap["حجة"].id
    }
  });

  const healthCollege = await prisma.college.create({
    data: {
      name: "المعهد الصحي",
      slug: "health-main",
      location: "Hajjah",
      universityId: healthUniversity.id
    }
  });

  const healthDept = await prisma.department.create({
    data: {
      name: "المعهد الصحي",
      collegeId: healthCollege.id
    }
  });

  const healthMajors = ["صيدلة", "تمريض", "مساعد طبيب", "مختبرات", "قبالة"];
  const healthMajorsList = [];
  for (const mName of healthMajors) {
    const major = await prisma.major.create({
      data: {
        name: mName,
        departmentId: healthDept.id
      }
    });
    healthMajorsList.push(major);
  }

  console.log('Creating Health Institute Groups for each Major and Level (Level 1 to 3)...');
  const healthGroupSuffixes = ['مجموعة أ (نظري)', 'مجموعة ب (عملي 1)', 'مجموعة ج (عملي 2)'];
  for (const major of healthMajorsList) {
    for (const lvl of levels.slice(0, 3)) { // Only Level 1, Level 2, Level 3
      for (const suffix of healthGroupSuffixes) {
        await prisma.group.create({
          data: {
            name: suffix,
            majorId: major.id,
            levelId: lvl.id,
            collegeId: healthCollege.id
          }
        });
      }
    }
  }

  // Health Institute Rooms
  console.log('Creating Health Institute Rooms...');
  const healthRoomsData = [
    { name: 'معمل الصيدلة', capacity: 30 },
    { name: 'معمل المختبرات', capacity: 30 },
    { name: 'قاعة 1 (صحي)', capacity: 50 },
    { name: 'قاعة 2 (صحي)', capacity: 50 }
  ];
  for (const rm of healthRoomsData) {
    await prisma.room.create({
      data: {
        name: rm.name,
        capacity: rm.capacity,
        collegeId: healthCollege.id
      }
    });
  }


  // Create SUPER_ADMIN Account
  console.log('Creating SUPER_ADMIN user...');
  const superAdminPasswordHash = await bcrypt.hash('708090', 10);
  const superAdmin = await prisma.admin.create({
    data: {
      name: 'Chief Architect',
      email: 'm.gh.alosimi@gmail.com',
      password: superAdminPasswordHash,
      role: 'SUPER_ADMIN'
    }
  });
  console.log(`SUPER_ADMIN created: ${superAdmin.email}`);

  // Create standard ADMIN users
  console.log('Creating college admins...');
  const adminPasswordHash = await bcrypt.hash('12345678', 10);
  
  await prisma.admin.create({
    data: {
      name: 'Applied Sciences Admin',
      email: 'admin.applied@manar.edu',
      password: adminPasswordHash,
      role: 'COLLEGE_ADMIN',
      collegeId: hajjahAppliedCollege.id
    }
  });

  await prisma.admin.create({
    data: {
      name: 'Al-Manar Admin',
      email: 'admin.manar@manar.edu',
      password: adminPasswordHash,
      role: 'COLLEGE_ADMIN',
      collegeId: almanarCollege.id
    }
  });

  await prisma.admin.create({
    data: {
      name: 'Health Institute Admin',
      email: 'admin.health@manar.edu',
      password: adminPasswordHash,
      role: 'COLLEGE_ADMIN',
      collegeId: healthCollege.id
    }
  });


  // Generate 1,000 realistic dummy students for Al-Manar
  console.log('Generating 1,000 realistic dummy students for Al-Manar College...');
  const firstNames = [
    'احمد', 'خالد', 'فاطمة', 'سارة', 'محمد', 'علي', 'عمر', 'عثمان',
    'صالح', 'عبدالله', 'زينب', 'منى', 'ياسمين', 'رنا', 'حمزة', 'بلال',
    'ياسر', 'سعيد', 'حسن', 'حسين', 'مريم', 'أروى', 'نهى', 'ريهام',
    'طارق', 'ماجد', 'سلطان', 'فيصل', 'سلمان', 'نورة', 'هيفاء', 'شهد',
    'مصطفى', 'عبد الرحمن', 'ابراهيم', 'شروق', 'روان', 'هند', 'بثينة', 'عادل'
  ];
  const lastNames = [
    'الحداد', 'العولقي', 'اليماني', 'صالح', 'الناشري', 'المعمري', 'الأهدل', 'الشرفي',
    'مفتاح', 'عبدالله', 'الصلوي', 'العبدلي', 'قشوة', 'الرشيدي', 'العتيبي', 'الشمري',
    'الحربي', 'المطيري', 'الدوسري', 'القحطاني', 'الغامدي', 'الزهراني', 'المالكي', 'الشهري',
    'صبري', 'باعلوي', 'السقاف', 'الجابري', 'العمودي', 'باوزير', 'الشبامي', 'الحضرمي'
  ];

  const studentsToCreate = [];
  const studentPasswordHash = await bcrypt.hash('12345678', 10);

  for (let i = 1; i <= 1000; i++) {
    const randFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${randFirst} ${randLast}`;

    const major = almanarMajorsList[(i - 1) % almanarMajorsList.length];
    const level = levels[(i - 1) % levels.length];

    // Find the correct Major-Level group for this student
    const group = almanarGroupsMap[`${major.id}_${level.id}_مجموعة أ (نظري)`];
    if (!group) continue;

    studentsToCreate.push({
      name: fullName,
      email: `student.${i}@manar.edu`,
      idNumber: `2026-${String(i).padStart(4, '0')}`,
      phone: `+96777${String(i).padStart(7, '0')}`,
      isEmailVerified: true,
      isPhoneVerified: true,
      password: studentPasswordHash,
      collegeId: almanarCollege.id,
      majorId: major.id,
      levelId: level.id,
      groupId: group.id
    });
  }

  console.log('Inserting 1,000 students...');
  await prisma.student.createMany({ data: studentsToCreate });
  console.log('1,000 dummy students seeded successfully.');

  // Call the function to inject the 5 test students
  await injectTestStudents();

  console.log('Seeding completed.');
}

async function injectTestStudents() {
  console.log('Injecting 5 specific test students for Al-Manar University College...');
  
  const college = await prisma.college.findFirst({
    where: { name: "كلية المنار الجامعية" }
  });
  
  if (!college) {
    console.error("Al-Manar University College not found in database!");
    return;
  }
  
  // Find departments in this college
  const departments = await prisma.department.findMany({
    where: { collegeId: college.id }
  });
  
  const deptIds = departments.map(d => d.id);
  
  // Find majors in these departments
  const majors = await prisma.major.findMany({
    where: { departmentId: { in: deptIds } }
  });
  
  if (majors.length === 0) {
    console.error("No majors found for Al-Manar University College!");
    return;
  }
  
  // Find levels
  const levels = await prisma.level.findMany();
  if (levels.length === 0) {
    console.error("No levels found in database!");
    return;
  }
  
  const studentPasswordHash = await bcrypt.hash('12345678', 10);
  
  const testStudents = [];
  for (let i = 1; i <= 5; i++) {
    const email = `test${i}@almanar.edu.ye`;
    const idNumber = `2026-TEST0${i}`;
    
    // Check if student already exists
    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { email },
          { idNumber }
        ]
      }
    });
    
    if (existing) {
      console.log(`Test student ${email} or ID ${idNumber} already exists. Skipping.`);
      continue;
    }
    
    const major = majors[(i - 1) % majors.length];
    const level = levels[(i - 1) % levels.length];
    
    // Find a group for this major and level in Al-Manar
    const group = await prisma.group.findFirst({
      where: {
        majorId: major.id,
        levelId: level.id,
        collegeId: college.id
      }
    });
    
    testStudents.push({
      name: `طالب تجريبي ${i}`,
      email,
      idNumber,
      phone: `+96777900000${i}`,
      isEmailVerified: true,
      isPhoneVerified: true,
      password: studentPasswordHash,
      collegeId: college.id,
      majorId: major.id,
      levelId: level.id,
      groupId: group ? group.id : null,
      googleId: null
    });
  }
  
  if (testStudents.length > 0) {
    await prisma.student.createMany({ data: testStudents });
    console.log(`Seeded ${testStudents.length} new test students.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error('Error seeding:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
