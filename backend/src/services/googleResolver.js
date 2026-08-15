const { prisma } = require('../db');

/**
 * Central Google Identity Resolver Abstraction
 * Resolves a verified Google identity ({ email, googleId, name }) against PostgreSQL DB tables (Student, Lecturer, Admin)
 * 
 * Rules:
 * 1. Search FIRST by googleId across Student, Lecturer, Admin.
 * 2. Search SECOND by verified email across Student, Lecturer, Admin.
 * 3. Auto-link googleId if matched by email and googleId is null.
 * 4. Return status:
 *    - 'EXISTING_ACCOUNT' (with complete/incomplete profile determination)
 *    - 'AMBIGUOUS_ACCOUNT' (conflict detected across multiple tables/records)
 *    - 'NEW_ACCOUNT' (0 matches)
 */
async function resolveGoogleIdentity({ email, googleId, name }) {
  if (!email && !googleId) {
    return { status: 'NEW_ACCOUNT', user: null, role: null };
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  const matches = [];

  // 1. Search by googleId across Student, Lecturer, Admin
  if (googleId) {
    try {
      const studentByGId = await prisma.student.findUnique({
        where: { googleId },
        include: { college: true, major: true, level: true, group: true }
      });
      if (studentByGId) matches.push({ user: studentByGId, role: 'STUDENT' });
    } catch (e) {}
  }

  // 2. Search by verified email if no googleId match found
  if (matches.length === 0 && normalizedEmail) {
    // Search Student by email
    try {
      const studentByEmail = await prisma.student.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { college: true, major: true, level: true, group: true }
      });
      if (studentByEmail) {
        matches.push({ user: studentByEmail, role: 'STUDENT' });
      }
    } catch (e) {}

    // Search Lecturer by email
    try {
      const lecturerByEmail = await prisma.lecturer.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { college: true }
      });
      if (lecturerByEmail) {
        matches.push({ user: lecturerByEmail, role: 'LECTURER' });
      }
    } catch (e) {}

    // Search Admin by email
    try {
      const adminByEmail = await prisma.admin.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { college: true, university: true }
      });
      if (adminByEmail) {
        matches.push({ user: adminByEmail, role: adminByEmail.role });
      }
    } catch (e) {}
  }

  // 3. Evaluate results
  if (matches.length > 1) {
    console.warn(`[GoogleResolver] Ambiguous account matches for email ${email}: ${matches.length} accounts found`);
    return {
      status: 'AMBIGUOUS_ACCOUNT',
      error: 'تم العثور على أكثر من حساب مرتبط بهذا البريد الإلكتروني. يرجى التواصل مع إدارة الجامعة.',
      user: null,
      role: null
    };
  }

  if (matches.length === 0) {
    return {
      status: 'NEW_ACCOUNT',
      code: 'ACCOUNT_NOT_FOUND',
      user: null,
      role: null,
      googleData: { email: normalizedEmail, name, googleId }
    };
  }

  // Exactly 1 match found
  let { user, role } = matches[0];

  // Auto-link googleId if googleId is provided and currently null on Student record
  if (role === 'STUDENT' && googleId && !user.googleId) {
    try {
      user = await prisma.student.update({
        where: { id: user.id },
        data: { googleId },
        include: { college: true, major: true, level: true, group: true }
      });
      console.log(`[GoogleResolver] Auto-linked googleId ${googleId} to student ID ${user.id}`);
    } catch (linkErr) {
      console.error(`[GoogleResolver] Failed to auto-link googleId: ${linkErr.message}`);
    }
  }

  // 4. Check profile completeness for Student
  let isProfileComplete = true;
  const missingFields = [];

  if (role === 'STUDENT') {
    if (!user.name || user.name.trim().length < 3) missingFields.push('name');
    if (!user.phone) missingFields.push('phone');
    if (!user.collegeId) missingFields.push('collegeId');
    if (!user.majorId) missingFields.push('majorId');
    if (!user.levelId) missingFields.push('levelId');

    if (missingFields.length > 0) {
      isProfileComplete = false;
    }
  }

  return {
    status: isProfileComplete ? 'PROFILE_COMPLETE' : 'PROFILE_INCOMPLETE',
    user,
    role,
    missingFields,
    googleData: { email: normalizedEmail, name, googleId }
  };
}

module.exports = {
  resolveGoogleIdentity
};
