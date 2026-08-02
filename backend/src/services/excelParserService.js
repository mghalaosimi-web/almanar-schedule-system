/**
 * @file excelParserService.js
 * @description خدمة معالجة وتحليل ملفات Excel المرفوعة واستيراد البيانات بشكل جماعي (الطلاب، الجداول، الامتحانات).
 * @author أنتيجرافيتي (Antigravity)
 */

const { prisma } = require('../db');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

function parseXlsxBase64(fileBase64) {
  const buffer = Buffer.from(fileBase64, 'base64');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

async function uploadStudents(fileBase64) {
  const rows = parseXlsxBase64(fileBase64);
  if (!rows.length) {
    throw new Error('Excel file is empty or has no data rows');
  }

  const results = { created: 0, skipped: 0, errors: [] };
  const candidateRows = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
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

      const existing = await prisma.student.findFirst({
        where: { OR: [{ email }, { idNumber }, { phone }] }
      });
      if (existing) {
        results.errors.push({ row: rowNum, reason: `Duplicate — email, ID, or phone already exists for "${name}"` });
        results.skipped++;
        continue;
      }

      let major = null;
      if (majorName) {
        major = await prisma.major.findFirst({
          where: { name: { contains: majorName, mode: 'insensitive' } }
        });

        if (!major) {
          let department = await prisma.department.findFirst();
          if (!department) {
            department = await prisma.department.create({
              data: { name: 'القسم العام' }
            });
          }
          major = await prisma.major.create({
            data: { name: majorName, departmentId: department.id }
          });
        }
      } else {
        major = await prisma.major.findFirst();
        if (!major) {
          let department = await prisma.department.findFirst() || await prisma.department.create({ data: { name: 'القسم العام' } });
          major = await prisma.major.create({ data: { name: 'التخصص العام', departmentId: department.id } });
        }
      }

      let level = levelName
        ? await prisma.level.findFirst({ where: { name: { contains: levelName, mode: 'insensitive' } } })
        : null;
      if (levelName && !level) {
        level = await prisma.level.create({ data: { name: levelName } });
      }
      if (!level) {
        level = await prisma.level.findFirst() || await prisma.level.create({ data: { name: 'المستوى الأول' } });
      }

      let group = groupName
        ? await prisma.group.findFirst({
            where: { name: { contains: groupName, mode: 'insensitive' } }
          })
        : null;
      if (groupName && !group && major) {
        group = await prisma.group.create({
          data: {
            name: groupName,
            majorId: major.id,
            levelId: level.id
          }
        });
      }

      candidateRows.push({
        name,
        email,
        idNumber,
        phone,
        plainPassword,
        isEmailVerified: true,
        majorId: major.id,
        levelId: level.id,
        groupId: group?.id || null
      });
    } catch (rowErr) {
      results.errors.push({ row: rowNum, reason: rowErr.message });
      results.skipped++;
    }
  }

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
      majorId: r.majorId,
      levelId: r.levelId,
      groupId: r.groupId
    }));

    const batchResult = await prisma.student.createMany({
      data: insertData,
      skipDuplicates: true
    });

    results.created = batchResult.count;
  }

  return results;
}

async function uploadSchedules(fileBase64) {
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

      const code = subjectCode || subjectName.slice(0, 8).replace(/\s/g, '_').toUpperCase() + '_' + Date.now();
      let subject = await prisma.subject.findUnique({ where: { code } });
      if (!subject) {
        subject = await prisma.subject.create({
          data: { name: subjectName, code, type: subjectType }
        });
      }

      let room = await prisma.room.findUnique({ where: { name: roomName } });
      if (!room) {
        room = await prisma.room.create({
          data: { name: roomName, capacity: roomCapacity }
        });
      }

      const group = await prisma.group.findFirst({
        where: { name: { contains: groupName, mode: 'insensitive' } }
      });
      if (!group) {
        results.errors.push({ row: rowNum, reason: `Group "${groupName}" not found` });
        results.skipped++;
        continue;
      }

      const lecturer = lecturerName
        ? await prisma.lecturer.findFirst({ where: { name: { contains: lecturerName, mode: 'insensitive' } } })
        : null;

      await prisma.schedule.create({
        data: {
          subjectId: subject.id,
          roomId: room.id,
          lecturerName: lecturerName || 'غير محدد',
          lecturerId: lecturer?.id || null,
          groupId: group.id,
          dayOfWeek,
          startTime,
          endTime
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

async function uploadExams(fileBase64) {
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

      const code = subjectCode || subjectName.slice(0, 8).replace(/\s/g, '_').toUpperCase();
      let subject = await prisma.subject.findUnique({ where: { code } });
      if (!subject) {
        subject = await prisma.subject.create({
          data: { name: subjectName, code, type: 'THEORY' }
        });
      }

      let room = await prisma.room.findUnique({ where: { name: roomName } });
      if (!room) {
        room = await prisma.room.create({
          data: { name: roomName, capacity: 50 }
        });
      }

      const group = await prisma.group.findFirst({
        where: { name: { contains: groupName, mode: 'insensitive' } }
      });
      if (!group) {
        results.errors.push({ row: rowNum, reason: `Group "${groupName}" not found` });
        results.skipped++;
        continue;
      }

      await prisma.examSchedule.create({
        data: {
          subjectId: subject.id,
          roomId: room.id,
          groupId: group.id,
          date: examDate,
          startTime,
          endTime
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
