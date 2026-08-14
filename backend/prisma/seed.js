require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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

function cleanName(name) {
  if (!name) return '';
  return name.replace(/^(د\.|أ\.|أ\.د\.|م\.)\s*/, '').trim();
}

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
  console.log('Clearing existing database tables...');
  const safeDelete = async (modelName) => {
    try {
      if (prisma[modelName] && typeof prisma[modelName].deleteMany === 'function') {
        await prisma[modelName].deleteMany();
      }
    } catch (e) {
      console.warn(`[SEED WARNING] Could not clear ${modelName}:`, e.message);
    }
  };

  await safeDelete('seatAllocation');
  await safeDelete('attendanceRecord');
  await safeDelete('verificationCode');
  await safeDelete('pushSubscription');
  await safeDelete('scheduleOverride');
  await safeDelete('notificationLog');
  await safeDelete('rescheduleRequest');
  await safeDelete('studentGoalCompletion');
  await safeDelete('academicGoal');
  await safeDelete('attendance');
  await safeDelete('groupResource');
  await safeDelete('pollVote');
  await safeDelete('poll');
  await safeDelete('exchangeComment');
  await safeDelete('exchangePost');
  await safeDelete('feedback');
  await safeDelete('studentTask');
  await safeDelete('student');
  await safeDelete('schedule');
  await safeDelete('examSchedule');
  await safeDelete('lecturer');
  await safeDelete('room');
  await safeDelete('subject');
  await safeDelete('group');
  await safeDelete('level');
  await safeDelete('major');
  await safeDelete('department');
  await safeDelete('admin');
  await safeDelete('tenantConfig');
  await safeDelete('college');
  await safeDelete('university');
  await safeDelete('governorate');
  console.log('All tables cleared.');

  console.log('Creating Governorate, University, College, and TenantConfig...');
  const governorate = await prisma.governorate.create({
    data: { name: 'صنعاء' }
  });
  const university = await prisma.university.create({
    data: {
      name: 'كلية المنار الجامعية',
      slug: 'almanar-college',
      themeColor: '#84cc16',
      governorateId: governorate.id
    }
  });
  const college = await prisma.college.create({
    data: {
      name: 'كلية المنار الجامعية',
      slug: 'almanar-main',
      universityId: university.id
    }
  });
  await prisma.tenantConfig.create({
    data: {
      collegeId: college.id,
      themeColor: '#84cc16',
      enabledFeatures: { qrAttendance: true, notifications: true }
    }
  });

  // Create Levels
  console.log('Creating Levels...');
  const levels = [];
  const levelsMap = {};
  for (let i = 1; i <= 4; i++) {
    const lvl = await prisma.level.create({ data: { name: `Level ${i}` } });
    levels.push(lvl);
    levelsMap[`Level ${i}`] = lvl;
  }

  console.log('Creating Departments & Majors...');
  const almanarMajorsMap = {};
  const almanarMajorsList = [];
  for (const deptConfig of almanarDeptsData) {
    const dept = await prisma.department.create({
      data: {
        name: deptConfig.name,
        collegeId: college.id
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

  console.log('Creating Groups for each combination of Major and Level...');
  const almanarGroupsMap = {};
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
            collegeId: college.id
          }
        });
        almanarGroupsMap[`${major.id}_${lvl.id}_${suffix}`] = grp;
      }
    }
  }

  console.log('Creating Rooms...');
  const almanarRoomsMap = {};
  for (const rm of almanarRoomsData) {
    const createdRoom = await prisma.room.create({
      data: {
        name: rm.name,
        capacity: rm.capacity,
        collegeId: college.id
      }
    });
    almanarRoomsMap[rm.name] = createdRoom;
  }

  console.log('Creating Lecturers...');
  const lecturerPasswordHash = await bcrypt.hash('12345678', 10);
  const almanarLecturersMap = {};
  for (const name of almanarLecturerNames) {
    const emailPrefix = getLecturerEmailPrefix(name);
    const email = `${emailPrefix}@almanar.edu.ye`;
    const lecturer = await prisma.lecturer.create({
      data: {
        name,
        email,
        password: lecturerPasswordHash,
        phone: `+96773` + String(Math.floor(1000000 + Math.random() * 9000000)),
        collegeId: college.id
      }
    });
    almanarLecturersMap[cleanName(name)] = lecturer;
  }

  console.log('Creating Subjects & Schedules...');
  const almanarSubjectsMap = {};
  let subjectIdx = 1;
  const schedulesToCreate = [];

  for (const item of almanarSchedulesData) {
    let subject = almanarSubjectsMap[item.subjectName];
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          name: item.subjectName,
          code: `M-SUB-${subjectIdx++}`,
          type: 'THEORY',
          collegeId: college.id
        }
      });
      almanarSubjectsMap[item.subjectName] = subject;
    }

    const room = almanarRoomsMap[item.roomName];
    if (!room) continue;

    const lecturer = almanarLecturersMap[cleanName(item.lecturerName)];
    const level = levelsMap[item.levelName];
    if (!level) continue;

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
        collegeId: college.id
      });
    }
  }

  await prisma.schedule.createMany({ data: schedulesToCreate });
  console.log(`Seeded ${schedulesToCreate.length} schedules for Al-Manar University College.`);

  // Create Master Admin User: أ.د. عبد الملك الحداد (Dean of College)
  console.log('Creating Master System Admin: أ.د. عبد الملك الحداد...');
  const adminPasswordHash = await bcrypt.hash('12345678', 10);
  const masterAdmin = await prisma.admin.upsert({
    where: { email: 'admin@almanar.edu.ye' },
    update: {
      name: 'أ.د. عبد الملك الحداد',
      password: adminPasswordHash,
      role: 'ADMIN',
      collegeId: college.id,
      universityId: university.id
    },
    create: {
      name: 'أ.د. عبد الملك الحداد',
      email: 'admin@almanar.edu.ye',
      password: adminPasswordHash,
      role: 'ADMIN',
      collegeId: college.id,
      universityId: university.id
    }
  });

  // Dedicated Dean email alias for Abdulmalik Al-Haddath
  await prisma.admin.upsert({
    where: { email: 'a.alhaddath@almanar.edu.ye' },
    update: {
      name: 'أ.د. عبد الملك الحداد (عميد الكلية)',
      password: adminPasswordHash,
      role: 'COLLEGE_ADMIN',
      collegeId: college.id,
      universityId: university.id
    },
    create: {
      name: 'أ.د. عبد الملك الحداد (عميد الكلية)',
      email: 'a.alhaddath@almanar.edu.ye',
      password: adminPasswordHash,
      role: 'COLLEGE_ADMIN',
      collegeId: college.id,
      universityId: university.id
    }
  });

  const superAdminPasswordHash = await bcrypt.hash('12345678', 10);
  await prisma.admin.upsert({
    where: { email: 'm.gh.alosimi@gmail.com' },
    update: {
      name: 'م. محمد العليمي (SUPER_ADMIN)',
      password: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      collegeId: college.id,
      universityId: university.id
    },
    create: {
      name: 'م. محمد العليمي (SUPER_ADMIN)',
      email: 'm.gh.alosimi@gmail.com',
      password: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      collegeId: college.id,
      universityId: university.id
    }
  });
  console.log(`Master Admin created successfully: ${masterAdmin.name} (${masterAdmin.email}) & SUPER_ADMIN m.gh.alosimi@gmail.com`);

  // Generate 1,000 realistic dummy students for Al-Manar
  console.log('Generating 1,000 realistic dummy students for Al-Manar University College...');
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

    const group = almanarGroupsMap[`${major.id}_${level.id}_مجموعة أ (نظري)`];
    if (!group) continue;

    studentsToCreate.push({
      name: fullName,
      email: `student.${i}@almanar.edu.ye`,
      idNumber: `2026-${String(i).padStart(4, '0')}`,
      phone: `+96777${String(i).padStart(7, '0')}`,
      isEmailVerified: true,
      isPhoneVerified: true,
      password: studentPasswordHash,
      majorId: major.id,
      levelId: level.id,
      groupId: group.id,
      collegeId: college.id
    });
  }

  console.log('Inserting 1,000 students...');
  await prisma.student.createMany({ data: studentsToCreate });
  console.log('1,000 dummy students seeded successfully.');

  await injectTestStudents(college.id);
  console.log('Seeding completed successfully.');
}

async function injectTestStudents(collegeId) {
  console.log('Injecting 5 test students for Al-Manar University College...');
  
  const majors = await prisma.major.findMany();
  const levels = await prisma.level.findMany();

  if (majors.length === 0 || levels.length === 0) return;
  
  const studentPasswordHash = await bcrypt.hash('12345678', 10);
  
  const testStudents = [];
  for (let i = 1; i <= 5; i++) {
    const email = `test${i}@almanar.edu.ye`;
    const idNumber = `2026-TEST0${i}`;
    
    const existing = await prisma.student.findFirst({
      where: { OR: [{ email }, { idNumber }] }
    });
    
    if (existing) continue;
    
    const major = majors[(i - 1) % majors.length];
    const level = levels[(i - 1) % levels.length];
    
    const group = await prisma.group.findFirst({
      where: { majorId: major.id, levelId: level.id }
    });
    
    testStudents.push({
      name: `طالب تجريبي ${i}`,
      email,
      idNumber,
      phone: `+96777900000${i}`,
      isEmailVerified: true,
      isPhoneVerified: true,
      password: studentPasswordHash,
      majorId: major.id,
      levelId: level.id,
      groupId: group ? group.id : null,
      googleId: null,
      collegeId: collegeId
    });
  }
  
  if (testStudents.length > 0) {
    await prisma.student.createMany({ data: testStudents });
    console.log(`Seeded ${testStudents.length} test students.`);
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
