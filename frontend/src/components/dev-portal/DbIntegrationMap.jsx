import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function DbIntegrationMap({ API_URL, token, isAr }) {
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTable, setExpandedTable] = useState(null);

  // Load available colleges to read whitelabelKey & db settings
  const fetchColleges = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/tenant-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const list = res.data.data.colleges || [];
        setColleges(list);
        if (list.length > 0) {
          setSelectedCollegeId(list[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load colleges configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  const activeCollege = colleges.find(c => c.id.toString() === selectedCollegeId);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(isAr ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard');
  };

  // Static schema documentation representing tenant database structure
  const schemaTables = [
    {
      name: 'Student',
      nameAr: 'الطلاب',
      descAr: 'جدول يحتوي على الملفات الأكاديمية للطلاب وبيانات المصادقة وصلاحيات المندوب.',
      descEn: 'Student academic profiles, credentials, and representative flags.',
      columns: [
        { name: 'id', type: 'Int (SERIAL)', descAr: 'المعرّف الرقمي التلقائي (مفتاح رئيسي)', descEn: 'Auto-increment primary key' },
        { name: 'name', type: 'String', descAr: 'اسم الطالب رباعي', descEn: 'Full student name' },
        { name: 'email', type: 'String (Unique)', descAr: 'البريد الإلكتروني الجامعي الموحد', descEn: 'Unique academic email address' },
        { name: 'idNumber', type: 'String (Unique)', descAr: 'الرقم الأكاديمي / الجامعي للمزامنة', descEn: 'Unique academic ID number' },
        { name: 'phone', type: 'String (Unique)', descAr: 'رقم هاتف الطالب للتأكيد والتحقق', descEn: 'Unique verified telephone number' },
        { name: 'isRepresentative', type: 'Boolean', descAr: 'مؤشر ما إذا كان الطالب مندوباً للشعبة', descEn: 'True if student acts as group representative' },
        { name: 'collegeId', type: 'Int (ForeignKey)', descAr: 'معرّف الكلية التابع لها الطالب', descEn: 'Links to College ID in central database' },
        { name: 'majorId', type: 'Int (ForeignKey)', descAr: 'معرّف التخصص الأكاديمي للطالب', descEn: 'Links to Major ID in tenant database' },
        { name: 'levelId', type: 'Int (ForeignKey)', descAr: 'معرّف المستوى الدراسي (السنة الدراسية)', descEn: 'Links to Level ID in tenant database' },
        { name: 'groupId', type: 'Int (ForeignKey, Nullable)', descAr: 'معرّف الشعبة الدراسية المنضم إليها', descEn: 'Links to Group ID in tenant database (Nullable)' }
      ]
    },
    {
      name: 'Lecturer',
      nameAr: 'أعضاء هيئة التدريس',
      descAr: 'جدول يحتوي على بيانات الدخول والاتصال للمدرسين والدكاترة بالكلية.',
      descEn: 'Teacher accounts, profiles, contact details and credentials.',
      columns: [
        { name: 'id', type: 'Int (SERIAL)', descAr: 'المعرّف الرقمي التلقائي (مفتاح رئيسي)', descEn: 'Auto-increment primary key' },
        { name: 'name', type: 'String', descAr: 'اسم المدرس / الدكتور', descEn: 'Full instructor name' },
        { name: 'email', type: 'String (Unique)', descAr: 'البريد الإلكتروني المخصص للمدرس', descEn: 'Unique instructor email' },
        { name: 'phone', type: 'String (Nullable)', descAr: 'رقم الهاتف للاتصال السريع', descEn: 'Optional phone number' },
        { name: 'collegeId', type: 'Int', descAr: 'معرّف الكلية التي يدرس بها', descEn: 'Links to College ID' }
      ]
    },
    {
      name: 'Group',
      nameAr: 'الشعب الدراسية',
      descAr: 'الشعب الدراسية والفصول الأكاديمية التي تجمع الطلاب لتلقي الجداول.',
      descEn: 'Study groups or classes that partition students for timetabling.',
      columns: [
        { name: 'id', type: 'Int (SERIAL)', descAr: 'المعرّف الرقمي التلقائي (مفتاح رئيسي)', descEn: 'Auto-increment primary key' },
        { name: 'name', type: 'String', descAr: 'اسم الشعبة (مثال: مجموعة أ، شعبة 2)', descEn: 'Class name (e.g. Group A, Class 2)' },
        { name: 'majorId', type: 'Int (ForeignKey)', descAr: 'معرّف التخصص التابع له الشعبة', descEn: 'Links to Major ID' },
        { name: 'levelId', type: 'Int (ForeignKey)', descAr: 'معرّف المستوى الدراسي للشعبة', descEn: 'Links to Level ID' },
        { name: 'collegeId', type: 'Int', descAr: 'معرّف الكلية الحاضنة للشعبة', descEn: 'Links to College ID' }
      ]
    },
    {
      name: 'Schedule',
      nameAr: 'الجدول الأكاديمي',
      descAr: 'الحصص الدراسية والمحاضرات المقررة أسبوعياً للشعب الدراسية.',
      descEn: 'Weekly academic lecture and class schedule slots.',
      columns: [
        { name: 'id', type: 'Int (SERIAL)', descAr: 'المعرّف الرقمي التلقائي (مفتاح رئيسي)', descEn: 'Auto-increment primary key' },
        { name: 'subjectId', type: 'Int (ForeignKey)', descAr: 'معرّف المادة الدراسية', descEn: 'Links to Subject ID' },
        { name: 'roomId', type: 'Int (ForeignKey)', descAr: 'معرّف القاعة أو المعمل', descEn: 'Links to Room ID' },
        { name: 'lecturerId', type: 'Int (ForeignKey, Nullable)', descAr: 'معرّف المحاضر المسؤول', descEn: 'Links to Lecturer ID' },
        { name: 'groupId', type: 'Int (ForeignKey)', descAr: 'معرّف الشعبة المستهدفة بالحصة', descEn: 'Links to Group ID' },
        { name: 'dayOfWeek', type: 'Enum (DayOfWeek)', descAr: 'اليوم الدراسي للمحاضرة', descEn: 'Day of week (e.g. SUNDAY)' },
        { name: 'startTime', type: 'String', descAr: 'توقيت بدء المحاضرة (مثال: 08:30)', descEn: 'Start time formatted string' },
        { name: 'endTime', type: 'String', descAr: 'توقيت انتهاء المحاضرة (مثال: 10:30)', descEn: 'End time formatted string' }
      ]
    },
    {
      name: 'Attendance',
      nameAr: 'حضور الطلاب (التحضير)',
      descAr: 'سجلات التحضير والغياب اليومية المسجلة عبر البث المباشر بواسطة المناديب.',
      descEn: 'Daily recorded class presence and absence history tracked by representatives.',
      columns: [
        { name: 'id', type: 'String (UUID)', descAr: 'معرّف السجل الفريد', descEn: 'Unique UUID string' },
        { name: 'date', type: 'DateTime', descAr: 'تاريخ التحضير المعتمد', descEn: 'Attendance sheet date context' },
        { name: 'status', type: 'String', descAr: 'حالة الحضور (PRESENT, ABSENT, EXCUSED)', descEn: 'Presence state status string' },
        { name: 'studentId', type: 'Int (ForeignKey)', descAr: 'معرّف الطالب المعني', descEn: 'Links to Student ID' },
        { name: 'scheduleId', type: 'Int (ForeignKey)', descAr: 'معرّف الحصة الدراسية المحددة بالجدول', descEn: 'Links to Schedule ID' },
        { name: 'recordedById', type: 'Int', descAr: 'معرّف الطالب المندوب الذي قام بالتحضير', descEn: 'ID of Representative who submitted the log' }
      ]
    }
  ];

  const sqlDdl = `-- DDL creation script for Tenant isolated database tables (PostgreSQL)

-- 1. Create Enums if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubjectType') THEN
    CREATE TYPE "SubjectType" AS ENUM ('THEORY', 'PRACTICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
    CREATE TYPE "DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
    CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OverrideType') THEN
    CREATE TYPE "OverrideType" AS ENUM ('TEMPORARY', 'PERMANENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestStatus') THEN
    CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostCategory') THEN
    CREATE TYPE "PostCategory" AS ENUM ('QUESTION', 'RESOURCE', 'HELP', 'GENERAL');
  END IF;
END$$;

-- 2. Create tables in logical order (dependencies first)

CREATE TABLE IF NOT EXISTS "Department" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Major" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "departmentId" INTEGER NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Level" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Group" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "majorId" INTEGER REFERENCES "Major"("id") ON DELETE SET NULL,
    "levelId" INTEGER REFERENCES "Level"("id") ON DELETE SET NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Student" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "idNumber" VARCHAR(255) UNIQUE NOT NULL,
    "idPhotoUrl" TEXT,
    "phone" VARCHAR(255) UNIQUE NOT NULL,
    "isEmailVerified" BOOLEAN DEFAULT TRUE,
    "isPhoneVerified" BOOLEAN DEFAULT FALSE,
    "isRepresentative" BOOLEAN DEFAULT FALSE,
    "password" TEXT,
    "googleId" VARCHAR(255) UNIQUE,
    "collegeId" INTEGER NOT NULL,
    "majorId" INTEGER NOT NULL REFERENCES "Major"("id"),
    "levelId" INTEGER NOT NULL REFERENCES "Level"("id"),
    "groupId" INTEGER REFERENCES "Group"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Subject" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(255) UNIQUE NOT NULL,
    "type" "SubjectType" NOT NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Room" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) UNIQUE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Lecturer" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "phone" VARCHAR(255),
    "collegeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Schedule" (
    "id" SERIAL PRIMARY KEY,
    "subjectId" INTEGER NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE,
    "roomId" INTEGER NOT NULL REFERENCES "Room"("id") ON DELETE CASCADE,
    "lecturerName" VARCHAR(255) NOT NULL,
    "lecturerId" INTEGER REFERENCES "Lecturer"("id") ON DELETE SET NULL,
    "groupId" INTEGER NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" VARCHAR(50) NOT NULL,
    "endTime" VARCHAR(50) NOT NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "RescheduleRequest" (
    "id" SERIAL PRIMARY KEY,
    "scheduleId" INTEGER NOT NULL REFERENCES "Schedule"("id") ON DELETE CASCADE,
    "lecturerId" INTEGER NOT NULL REFERENCES "Lecturer"("id") ON DELETE CASCADE,
    "requestType" VARCHAR(50) NOT NULL,
    "newDayOfWeek" "DayOfWeek",
    "newStartTime" VARCHAR(50),
    "newEndTime" VARCHAR(50),
    "newRoomId" INTEGER REFERENCES "Room"("id") ON DELETE SET NULL,
    "reason" TEXT,
    "status" "RequestStatus" DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ScheduleOverride" (
    "id" SERIAL PRIMARY KEY,
    "scheduleId" INTEGER NOT NULL REFERENCES "Schedule"("id") ON DELETE CASCADE,
    "newStartTime" VARCHAR(50),
    "newEndTime" VARCHAR(50),
    "newRoomId" INTEGER REFERENCES "Room"("id") ON DELETE SET NULL,
    "date" TIMESTAMP NOT NULL,
    "overrideType" "OverrideType" NOT NULL
);

CREATE TABLE IF NOT EXISTS "Attendance" (
    "id" VARCHAR(255) PRIMARY KEY,
    "date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(50) NOT NULL,
    "studentId" INTEGER NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
    "scheduleId" INTEGER NOT NULL REFERENCES "Schedule"("id") ON DELETE CASCADE,
    "recordedById" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "ExamSchedule" (
    "id" SERIAL PRIMARY KEY,
    "subjectId" INTEGER NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE,
    "roomId" INTEGER NOT NULL REFERENCES "Room"("id") ON DELETE CASCADE,
    "groupId" INTEGER NOT NULL REFERENCES "Group"("id") ON DELETE CASCADE,
    "date" TIMESTAMP NOT NULL,
    "startTime" VARCHAR(50) NOT NULL,
    "endTime" VARCHAR(50) NOT NULL,
    "collegeId" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "SeatAllocation" (
    "id" SERIAL PRIMARY KEY,
    "studentId" INTEGER NOT NULL REFERENCES "Student"("id") ON DELETE CASCADE,
    "examScheduleId" INTEGER NOT NULL REFERENCES "ExamSchedule"("id") ON DELETE CASCADE,
    "seatNumber" VARCHAR(50) NOT NULL,
    CONSTRAINT "SeatAllocation_student_exam_unique" UNIQUE ("studentId", "examScheduleId"),
    CONSTRAINT "SeatAllocation_exam_seat_unique" UNIQUE ("examScheduleId", "seatNumber")
);`;

  // Filter tables based on search query
  const filteredTables = schemaTables.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchesTableName = t.name.toLowerCase().includes(query) || t.nameAr.includes(query);
    const matchesColumns = t.columns.some(c => c.name.toLowerCase().includes(query) || c.descAr.includes(query));
    return matchesTableName || matchesColumns;
  });

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      
      {/* Dynamic Key Selector Card */}
      <div className="bg-[#050505]/90 border border-indigo-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
        <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2 flex items-center gap-2">
          <span>🗝️</span>
          {isAr ? 'عوامل ارتباط ومفاتيح الكلية المحددة' : 'Active College Licensing & Keys'}
        </h3>
        <p className="text-[11px] text-slate-400 mb-6">
          {isAr ? 'حدد الكلية لعرض مفاتيح الأمان ورابط الاتصال الخاص بها بمشروع الجداول.' : 'Select college node to verify its security licenses and DB linking status.'}
        </p>

        {loading ? (
          <div className="py-4 text-center text-xs text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading configurations...'}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="w-full md:w-1/3">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{isAr ? 'الكلية المستهدفة' : 'Target College'}</label>
                <select
                  value={selectedCollegeId}
                  onChange={e => setSelectedCollegeId(e.target.value)}
                  className="w-full bg-black border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {colleges.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                </select>
              </div>

              {activeCollege && (
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{isAr ? 'مفتاح الترخيص (Whitelabel Key)' : 'Security Whitelabel Key'}</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-black/60 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-emerald-400 truncate select-all">
                        {activeCollege.tenantConfig?.whitelabelKey || (isAr ? 'غير مولد' : 'Not generated')}
                      </div>
                      {activeCollege.tenantConfig?.whitelabelKey && (
                        <button
                          onClick={() => copyToClipboard(activeCollege.tenantConfig.whitelabelKey)}
                          className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold transition"
                        >
                          {isAr ? 'نسخ' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{isAr ? 'قاعدة البيانات الموجهة' : 'Dynamic Data Routing'}</label>
                    <div className="bg-black/60 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-cyan-400 truncate">
                      {activeCollege.tenantConfig?.databaseUrlOverride ? (isAr ? 'قاعدة بيانات خارجية مخصصة' : 'Isolated External Database') : (isAr ? 'قاعدة البيانات المركزية الافتراضية' : 'Shared Central Instance')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Schema Explorer & DDL Script */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Schema Explorer */}
        <div className="lg:col-span-2 bg-[#050505]/90 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-black text-white">{isAr ? 'مستكشف الجداول وعوامل الارتباط' : 'Schema & Relation Explorer'}</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">{isAr ? 'فهرسة وتوصيف متطلبات جداول الكلية لربط الطلاب والبيانات.' : 'Detailed indexing of isolated tenant tables required to route student records.'}</p>
            </div>
            
            {/* Search Input */}
            <input
              type="text"
              placeholder={isAr ? "ابحث عن جدول أو حقل..." : "Search tables or fields..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-black border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none w-full sm:w-48 text-right font-sans"
            />
          </div>

          <div className="space-y-3">
            {filteredTables.map(table => {
              const isExpanded = expandedTable === table.name;
              return (
                <div key={table.name} className="border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden bg-black/40 transition">
                  
                  {/* Table Header Summary */}
                  <div
                    onClick={() => setExpandedTable(isExpanded ? null : table.name)}
                    className="p-4 flex justify-between items-center cursor-pointer select-none hover:bg-slate-900/10 transition"
                  >
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-indigo-400">{table.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">({isAr ? table.nameAr : table.name})</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{isAr ? table.descAr : table.descEn}</p>
                    </div>
                    <span className="text-slate-500 text-xs shrink-0">{isExpanded ? '▼' : '◀'}</span>
                  </div>

                  {/* Expanded Columns Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-850 bg-black/60 p-4 overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-bold">
                            <th className="pb-2 pl-4 text-right">{isAr ? 'اسم العمود' : 'Column'}</th>
                            <th className="pb-2 px-4 text-right">{isAr ? 'نوع البيانات' : 'Data Type'}</th>
                            <th className="pb-2 pr-4 text-right">{isAr ? 'الوصف ومفاتيح الربط' : 'Description & Constraints'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {table.columns.map(col => (
                            <tr key={col.name} className="text-slate-300 hover:bg-slate-950/40">
                              <td className="py-2.5 pl-4 font-mono font-bold text-slate-200">{col.name}</td>
                              <td className="py-2.5 px-4 font-mono text-[10px] text-cyan-400">{col.type}</td>
                              <td className="py-2.5 pr-4 text-[10px] text-slate-400">{isAr ? col.descAr : col.descEn}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-600">{isAr ? 'لا توجد جداول مطابقة للبحث' : 'No matching tables found.'}</div>
            )}
          </div>
        </div>

        {/* Right Side: Copyable SQL Script */}
        <div className="bg-[#050505]/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between h-[500px] lg:h-auto">
          <div>
            <h4 className="text-sm font-black text-white">{isAr ? 'كود تأسيس الجداول (SQL DDL)' : 'Database Setup Script (SQL)'}</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">{isAr ? 'قم بنسخ وتشغيل هذا الكود البرمجي في قاعدة بيانات الكلية الخارجية لبناء الجداول المطلوبة مباشرة.' : 'Execute this query on your custom tenant PostgreSQL database to instantly provision all structures.'}</p>
          </div>

          <div className="flex-1 my-4 bg-black border border-slate-850 rounded-xl p-3 overflow-y-auto relative font-mono text-[10px] text-emerald-500/90 leading-relaxed text-left" dir="ltr">
            <pre className="whitespace-pre-wrap">{sqlDdl}</pre>
          </div>

          <button
            onClick={() => copyToClipboard(sqlDdl)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(79,70,229,0.3)] transition"
          >
            {isAr ? '📋 نسخ كود الـ SQL بالكامل' : '📋 Copy Entire DDL Code'}
          </button>
        </div>

      </div>

    </div>
  );
}
