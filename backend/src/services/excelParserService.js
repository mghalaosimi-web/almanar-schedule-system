/**
 * @file excelParserService.js
 * @description خدمة معالجة وتحليل ملفات Excel المرفوعة واستيراد البيانات بشكل جماعي (الطلاب، الجداول، الامتحانات).
 * @author أنتيجرافيتي (Antigravity)
 */

const { prisma } = require('../db');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

/**
 * فك تشفير سلسلة الـ Base64 وقراءة ملف الـ Excel لاستخراج بيانات الورقة الأولى كصفوف JSON.
 * 
 * @param {string} fileBase64 - السلسلة المشفرة بصيغة Base64 للملف المرفوع.
 * @returns {Array<Object>} مصفوفة من كائنات الأسطر المستخرجة من جدول البيانات.
 */
function parseXlsxBase64(fileBase64) {
  const buffer = Buffer.from(fileBase64, 'base64');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

/**
 * معالجة واستيراد الطلاب جماعياً من ملف Excel.
 * 
 * التدفق البرمجي والتحسين الفني:
 * 1. فك تشفير ملف Excel وقراءة الصفوف.
 * 2. التحقق من وجود بيانات فعلية في الملف.
 * 3. المرحلة الأولى (Phase 1): التحقق المتتابع الفردي من صحة الصفوف وحل الموارد المشتركة:
 *    - التأكد من عدم نقص الحقول الأساسية (الاسم، البريد، رقم الهوية، الهاتف).
 *    - التحقق من تكرار البريد، الهاتف، أو رقم الهوية في قاعدة البيانات لتفادي التعارض.
 *    - حل التخصص (Major): فحص وجود التخصص وفي حال غيابه، يتم إنشاء قسم عام وتخصص جديد بشكل تلقائي لمنع أخطاء العلاقات.
 *    - حل المستوى (Level) والشعبة (Group): البحث عنهم في الكلية المعنية وإنشاؤهم عند الحاجة.
 * 4. المرحلة الثانية (Phase 2): تشفير كلمات المرور بشكل متوازٍ (Concurrently) باستخدام الـ Promises لرفع أداء المعالجة البرمجية (حيث أن عملية التشفير مستهلكة لوقت المعالج CPU).
 * 5. إدخال البيانات دفعة واحدة (Bulk Insert) باستخدام `createMany` لتقليل استهلاك موارد خادم قاعدة البيانات وسرعة الإنجاز.
 * 
 * @param {string} fileBase64 - كائن الملف مرمزاً بـ Base64.
 * @param {number} targetCollegeId - معرف الكلية المستهدفة.
 * @returns {Promise<Object>} يحتوي على إحصائيات الطلاب المنشئين والصفوف المتخطاة والأخطاء التفصيلية.
 */
async function uploadStudents(fileBase64, targetCollegeId) {
  const rows = parseXlsxBase64(fileBase64);
  if (!rows.length) {
    throw new Error('Excel file is empty or has no data rows');
  }

  const results = { created: 0, skipped: 0, errors: [] };
  const candidateRows = []; // الصفوف التي اجتازت التحقق ومستعدة للإدخال الجماعي

  // ── المرحلة الأولى: التحقق وحل الهياكل التعليمية بشكل متسلسل لتجنب التنافس (Race Conditions) ──
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // رقم الصف في ملف الإكسل (مع احتساب سطر العناوين)
    try {
      const name = String(row['name'] || row['الاسم'] || '').trim();
      const email = String(row['email'] || row['البريد الإلكتروني'] || '').trim().toLowerCase();
      const idNumber = String(row['idNumber'] || row['رقم الهوية'] || '').trim();
      const phone = String(row['phone'] || row['الهاتف'] || '').trim();
      const majorName = String(row['majorName'] || row['التخصص'] || '').trim();
      const levelName = String(row['levelName'] || row['المستوى'] || '').trim();
      const groupName = String(row['groupName'] || row['الشعبة'] || '').trim();
      const plainPassword = String(row['password'] || row['كلمة المرور'] || idNumber || '123456').trim();

      if (!name || !email || !idNumber || !phone) {
        results.errors.push({ row: rowNum, reason: `Missing required fields (name, email, idNumber, phone)` });
        results.skipped++;
        continue;
      }

      // فحص تكرار البيانات الفردية
      const existing = await prisma.student.findFirst({
        where: { OR: [{ email }, { idNumber }, { phone }] }
      });
      if (existing) {
        results.errors.push({ row: rowNum, reason: `Duplicate — email, ID, or phone already exists for "${name}"` });
        results.skipped++;
        continue;
      }

      // حل التخصص (Major) والقسم (Department)
      let major = null;
      if (majorName) {
        major = await prisma.major.findFirst({
          where: {
            name: { contains: majorName, mode: 'insensitive' },
            department: { collegeId: targetCollegeId }
          }
        });

        if (!major) {
          let department = await prisma.department.findFirst({
            where: { collegeId: targetCollegeId }
          });
          if (!department) {
            department = await prisma.department.create({
              data: { name: 'القسم العام', collegeId: targetCollegeId }
            });
          }
          major = await prisma.major.create({
            data: { name: majorName, departmentId: department.id }
          });
        }
      } else {
        major = await prisma.major.findFirst({
          where: { department: { collegeId: targetCollegeId } }
        });

        if (!major) {
          let department = await prisma.department.findFirst({
            where: { collegeId: targetCollegeId }
          });
          if (!department) {
            department = await prisma.department.create({
              data: { name: 'القسم العام', collegeId: targetCollegeId }
            });
          }
          major = await prisma.major.create({
            data: { name: 'التخصص العام', departmentId: department.id }
          });
        }
      }

      // حل المستوى الدراسي (Level)
      let level = levelName
        ? await prisma.level.findFirst({ where: { name: { contains: levelName, mode: 'insensitive' } } })
        : null;
      if (levelName && !level) {
        level = await prisma.level.create({ data: { name: levelName } });
      }
      if (!level) {
        level = await prisma.level.findFirst() || await prisma.level.create({ data: { name: 'المستوى الأول' } });
      }

      // حل شعبة الدراسة (Group)
      let group = groupName
        ? await prisma.group.findFirst({
            where: {
              name: { contains: groupName, mode: 'insensitive' },
              collegeId: targetCollegeId
            }
          })
        : null;
      if (groupName && !group && major) {
        group = await prisma.group.create({
          data: {
            name: groupName,
            majorId: major.id,
            levelId: level.id,
            collegeId: targetCollegeId
          }
        });
      }

      // حفظ الصف الجاهز للإدخال الجماعي
      candidateRows.push({
        name,
        email,
        idNumber,
        phone,
        plainPassword,
        isEmailVerified: true,
        collegeId: targetCollegeId,
        majorId: major.id,
        levelId: level.id,
        groupId: group?.id || null
      });
    } catch (rowErr) {
      results.errors.push({ row: rowNum, reason: rowErr.message });
      results.skipped++;
    }
  }

  // ── المرحلة الثانية: تشفير كلمات المرور بالتوازي ثم الإدخال كدفعة واحدة ──
  if (candidateRows.length > 0) {
    const salt = await bcrypt.genSalt(10);
    const hashedPasswords = await Promise.all(
      candidateRows.map(r => bcrypt.hash(r.plainPassword, salt))
    );

    const insertData = candidateRows.map((r, idx) => ({
      name: r.name,
      email: r.email,
      idNumber: r.idNumber,
      phone: r.phone,
      password: hashedPasswords[idx],
      isEmailVerified: r.isEmailVerified,
      collegeId: r.collegeId,
      majorId: r.majorId,
      levelId: r.levelId,
      groupId: r.groupId
    }));

    // إدخال جماعي سريع بقاعدة البيانات وتخطي الصفوف المكررة الصامتة
    const batchResult = await prisma.student.createMany({
      data: insertData,
      skipDuplicates: true
    });

    results.created = batchResult.count;
  }

  return results;
}

/**
 * معالجة واستيراد الجدول الدراسي (Schedules) جماعياً من ملف Excel.
 * 
 * التدفق البرمجي:
 * 1. فك تشفير ملف Excel والتحقق من صحته.
 * 2. التحقق من تطابق أسماء الأيام المدرجة مع الأيام الرسمية المدعومة.
 * 3. البحث عن المواد (Subjects) والقاعات (Rooms) والشعب (Groups) والمحاضرين وتسكينهم تلقائياً.
 * 4. إنشاء السجل الخاص بالجدول في قاعدة البيانات.
 * 
 * @param {string} fileBase64 - كائن ملف الـ Excel مرمزاً بـ Base64.
 * @param {number} targetCollegeId - معرف الكلية المستهدفة.
 * @returns {Promise<Object>} يحتوي على إحصائيات الجداول المضافة والمخطاة.
 */
async function uploadSchedules(fileBase64, targetCollegeId) {
  const rows = parseXlsxBase64(fileBase64);
  if (!rows.length) {
    throw new Error('Excel file is empty or has no data rows');
  }

  const VALID_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const subjectName = String(row['subjectName'] || row['اسم المادة'] || '').trim();
      const subjectCode = String(row['subjectCode'] || row['رمز المادة'] || '').trim();
      const subjectTypeRaw = String(row['subjectType'] || row['نوع المادة'] || 'THEORY').trim().toUpperCase();
      const subjectType = subjectTypeRaw === 'PRACTICAL' ? 'PRACTICAL' : 'THEORY';
      const roomName = String(row['roomName'] || row['القاعة'] || '').trim();
      const roomCapacityRaw = parseInt(row['roomCapacity'] || row['سعة القاعة'] || '45');
      const roomCapacity = isNaN(roomCapacityRaw) ? 45 : roomCapacityRaw;
      const lecturerName = String(row['lecturerName'] || row['اسم المحاضر'] || '').trim();
      const groupName = String(row['groupName'] || row['الشعبة'] || '').trim();
      const dayOfWeek = String(row['dayOfWeek'] || row['اليوم'] || '').trim().toUpperCase();
      const startTime = String(row['startTime'] || row['وقت البدء'] || '').trim();
      const endTime = String(row['endTime'] || row['وقت الانتهاء'] || '').trim();

      if (!subjectName || !roomName || !groupName || !dayOfWeek || !startTime || !endTime) {
        results.errors.push({ row: rowNum, reason: 'Missing required fields (subjectName, roomName, groupName, dayOfWeek, startTime, endTime)' });
        results.skipped++;
        continue;
      }

      if (!VALID_DAYS.includes(dayOfWeek)) {
        results.errors.push({ row: rowNum, reason: `Invalid dayOfWeek "${dayOfWeek}". Must be one of: ${VALID_DAYS.join(', ')}` });
        results.skipped++;
        continue;
      }

      // إيجاد أو إنشاء المادة
      const code = subjectCode || subjectName.slice(0, 8).replace(/\s/g, '_').toUpperCase() + '_' + Date.now();
      const existingSubject = await prisma.subject.findUnique({ where: { code } });
      if (existingSubject && existingSubject.collegeId !== targetCollegeId) {
        results.errors.push({ row: rowNum, reason: `رمز المادة "${code}" مستخدم بالفعل في كلية أخرى` });
        results.skipped++;
        continue;
      }
      let subject = existingSubject;
      if (!subject) {
        subject = await prisma.subject.create({
          data: { name: subjectName, code, type: subjectType, collegeId: targetCollegeId }
        });
      }

      // إيجاد أو إنشاء القاعة
      const existingRoom = await prisma.room.findUnique({ where: { name: roomName } });
      if (existingRoom && existingRoom.collegeId !== targetCollegeId) {
        results.errors.push({ row: rowNum, reason: `اسم القاعة "${roomName}" مستخدم بالفعل في كلية أخرى` });
        results.skipped++;
        continue;
      }
      let room = existingRoom;
      if (!room) {
        room = await prisma.room.create({
          data: { name: roomName, capacity: roomCapacity, collegeId: targetCollegeId }
        });
      }

      // إيجاد الشعبة الدراسية
      const group = await prisma.group.findFirst({
        where: { name: { contains: groupName, mode: 'insensitive' }, collegeId: targetCollegeId }
      });
      if (!group) {
        results.errors.push({ row: rowNum, reason: `Group "${groupName}" not found in this college` });
        results.skipped++;
        continue;
      }

      // إيجاد المحاضر الاختياري
      const lecturer = lecturerName
        ? await prisma.lecturer.findFirst({ where: { name: { contains: lecturerName, mode: 'insensitive' }, collegeId: targetCollegeId } })
        : null;

      // إدراج الحصة الدراسية
      await prisma.schedule.create({
        data: {
          subjectId: subject.id,
          roomId: room.id,
          lecturerName: lecturerName || 'غير محدد',
          lecturerId: lecturer?.id || null,
          groupId: group.id,
          dayOfWeek,
          startTime,
          endTime,
          collegeId: targetCollegeId
        }
      });
      results.created++;
    } catch (rowErr) {
      results.errors.push({ row: rowNum, reason: rowErr.message });
      results.skipped++;
    }
  }

  return results;
}

/**
 * معالجة واستيراد جدول الاختبارات (Exams) جماعياً من ملف Excel.
 * 
 * @param {string} fileBase64 - كائن ملف الـ Excel مرمزاً بـ Base64.
 * @param {number} targetCollegeId - معرف الكلية المستهدفة.
 * @returns {Promise<Object>} يحتوي على تفاصيل ونتائج إدخال جداول الاختبارات.
 */
async function uploadExams(fileBase64, targetCollegeId) {
  const rows = parseXlsxBase64(fileBase64);
  if (!rows.length) {
    throw new Error('Excel file is empty or has no data rows');
  }

  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const subjectName = String(row['subjectName'] || row['اسم المادة'] || '').trim();
      const subjectCode = String(row['subjectCode'] || row['رمز المادة'] || '').trim();
      const roomName = String(row['roomName'] || row['القاعة'] || '').trim();
      const groupName = String(row['groupName'] || row['الشعبة'] || '').trim();
      const examDateRaw = String(row['examDate'] || row['تاريخ الاختبار'] || '').trim();
      const startTime = String(row['startTime'] || row['وقت البدء'] || '').trim();
      const endTime = String(row['endTime'] || row['وقت الانتهاء'] || '').trim();

      if (!subjectName || !roomName || !groupName || !examDateRaw || !startTime || !endTime) {
        results.errors.push({ row: rowNum, reason: 'Missing required fields' });
        results.skipped++;
        continue;
      }

      const examDate = new Date(examDateRaw);
      if (isNaN(examDate.getTime())) {
        results.errors.push({ row: rowNum, reason: `Invalid examDate "${examDateRaw}". Use YYYY-MM-DD format.` });
        results.skipped++;
        continue;
      }

      // إيجاد أو إنشاء المادة
      const code = subjectCode || subjectName.slice(0, 8).replace(/\s/g, '_').toUpperCase();
      const existingSubject = await prisma.subject.findUnique({ where: { code } });
      if (existingSubject && existingSubject.collegeId !== targetCollegeId) {
        results.errors.push({ row: rowNum, reason: `رمز المادة "${code}" مستخدم بالفعل في كلية أخرى` });
        results.skipped++;
        continue;
      }
      let subject = existingSubject;
      if (!subject) {
        subject = await prisma.subject.create({
          data: { name: subjectName, code, type: 'THEORY', collegeId: targetCollegeId }
        });
      }

      // إيجاد أو إنشاء القاعة
      const existingRoom = await prisma.room.findUnique({ where: { name: roomName } });
      if (existingRoom && existingRoom.collegeId !== targetCollegeId) {
        results.errors.push({ row: rowNum, reason: `اسم القاعة "${roomName}" مستخدم بالفعل في كلية أخرى` });
        results.skipped++;
        continue;
      }
      let room = existingRoom;
      if (!room) {
        room = await prisma.room.create({
          data: { name: roomName, capacity: 50, collegeId: targetCollegeId }
        });
      }

      // إيجاد الشعبة الدراسية
      const group = await prisma.group.findFirst({
        where: { name: { contains: groupName, mode: 'insensitive' }, collegeId: targetCollegeId }
      });
      if (!group) {
        results.errors.push({ row: rowNum, reason: `Group "${groupName}" not found` });
        results.skipped++;
        continue;
      }

      // إدراج جدول الاختبار
      await prisma.examSchedule.create({
        data: {
          subjectId: subject.id,
          roomId: room.id,
          groupId: group.id,
          date: examDate,
          startTime,
          endTime,
          collegeId: targetCollegeId
        }
      });
      results.created++;
    } catch (rowErr) {
      results.errors.push({ row: rowNum, reason: rowErr.message });
      results.skipped++;
    }
  }

  return results;
}

module.exports = {
  parseXlsxBase64,
  uploadStudents,
  uploadSchedules,
  uploadExams
};
