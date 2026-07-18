const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const { prisma } = require('../../db');
const { verifyToken } = require('../../middleware/auth');
const systemSettings  = require('../../services/systemSettings');
const {
  captchaStore, otpStore,
  authLimiter, otpLimiter, strictAuthLimiter,
  verifyGoogleToken,
} = require('./shared');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
// 4. POST /api/auth/complete-profile
// PATCH [SEC]: verifyToken added — requires valid Google session before allowing profile creation
router.post('/complete-profile', authenticateToken, async (req, res) => {
  try {
    const { email, name, phone, idNumber, collegeId, majorId, levelId } = req.body;
    
    if (!name || !phone || !collegeId || !majorId || !levelId) {
      return res.status(400).json({ success: false, error: 'All profile fields are required' });
    }

    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 3) {
      return res.status(400).json({ success: false, error: 'يجب إدخال الاسم الثلاثي أو الرباعي على الأقل' });
    }

    const suffix = phone.replace('+967', '');
    if (suffix.length !== 9 || !/^\d+$/.test(suffix)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف يجب أن يتكون من 9 أرقام بعد الرمز الدولي' });
    }

    if (idNumber && idNumber.trim() !== '') {
      if (!/^\d+$/.test(idNumber.trim()) || idNumber.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'الرقم الجامعي يجب أن يتكون من أرقام فقط ولا يقل عن 5 خانات' });
      }
    }

    const resolvedId = (idNumber && idNumber.trim() !== '') ? idNumber.trim() : 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const studentId = req.user.id;
    const existingStudent = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existingStudent) {
      return res.status(404).json({ success: false, error: 'Student account not found' });
    }

    if (idNumber && idNumber.trim() !== '' && idNumber.trim() !== existingStudent.idNumber) {
      const existingIdNumber = await prisma.student.findUnique({ where: { idNumber: resolvedId } });
      if (existingIdNumber && existingIdNumber.id !== studentId) {
        return res.status(400).json({ success: false, error: 'A student with this academic ID already exists' });
      }
    }

    const updateData = {
      name,
      phone,
      idNumber: resolvedId,
      collegeId: parseInt(collegeId),
      majorId: parseInt(majorId),
      levelId: parseInt(levelId),
      isEmailVerified: true,
      isPhoneVerified: true
    };
    if (email) updateData.email = email;

    const student = await prisma.student.update({
      where: { id: studentId },
      data: updateData
    });

    let collegeName = null;
    let universityName = null;
    let universityLogo = null;
    let themeColor = null;

    const college = await prisma.college.findUnique({
      where: { id: student.collegeId },
      include: { university: true }
    });
    if (college) {
      collegeName = college.name;
      if (college.university) {
        universityName = college.university.name;
        universityLogo = college.university.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                         college.university.slug === 'almanar-college' ? '/almanar-logo.png' : college.university.logoUrl;
        themeColor = college.university.themeColor;
      }
    }

    const token = jwt.sign(
      { 
        id: student.id, 
        name: student.name, 
        role: 'STUDENT', 
        majorId: student.majorId, 
        levelId: student.levelId, 
        isRepresentative: student.isRepresentative, 
        collegeId: student.collegeId 
      },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Call session activity tracker
    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(student, 'STUDENT');
    } catch (e) {}

    res.status(201).json({
      success: true,
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        majorId: student.majorId,
        levelId: student.levelId,
        isRepresentative: student.isRepresentative,
        collegeId: student.collegeId,
        collegeName,
        universityName,
        universityLogo,
        themeColor
      }
    });
  } catch (error) {
    console.error('[API] Complete profile error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'A student with this academic ID or phone already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to complete profile' });
  }
});

// 5. POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { phone, email } = req.body;
    if (!phone || !email) {
      return res.status(400).json({ success: false, error: 'Phone number and email are required' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, { code: otpCode, expires: Date.now() + 5 * 60 * 1000 });

    console.log('[OTP SYSTEM] Verification code generated for:', email);

    // Never log the OTP code itself in production — use email delivery only

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const mailOptions = {
          from: `"كلية المنار الجامعية" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'رمز التحقق الخاص بك (OTP)',
          text: `أهلاً بك في كلية المنار الجامعية.\n\nرمز التحقق الخاص بك هو: ${otpCode}\n\nيرجى عدم مشاركة هذا الرمز مع أي شخص. الرمز صالح لمدة 5 دقائق.\n\nAl-Manar University College`,
          html: `
            <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right; color: #333; max-width: 500px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
              <div style="background-color: #84cc16; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">كلية المنار الجامعية</h2>
              </div>
              <div style="padding: 20px;">
                <p>أهلاً بك،</p>
                <p>رمز التحقق الخاص بك هو:</p>
                <div style="text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; background-color: #f3f4f6; padding: 10px 20px; border-radius: 8px; letter-spacing: 5px;">${otpCode}</span>
                </div>
                <p style="color: #666; font-size: 13px;">يرجى عدم مشاركة هذا الرمز مع أي شخص. الرمز صالح لمدة 5 دقائق.</p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[OTP SYSTEM] 📧 Email sent successfully to ${email}`);
      } catch (emailErr) {
        console.error('[OTP SYSTEM] ❌ Failed to send email:', emailErr.message);
      }
    }

    res.status(200).json({ success: true, message: 'OTP generated successfully' });
  } catch (err) {
    console.error('[OTP] Failed to generate OTP:', err);
    res.status(500).json({ success: false, error: 'Failed to generate OTP' });
  }
});

// 6. GET /api/auth/captcha
router.get('/captcha', (req, res) => {
  const challengeId = Math.random().toString(36).substring(2, 15);
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;

  captchaStore.set(challengeId, { answer, expires: Date.now() + 5 * 60 * 1000 });

  res.status(200).json({
    success: true,
    challengeId,
    question: `What is ${num1} + ${num2}?`
  });
});

// 7. POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    if (systemSettings.get('maintenanceMode')) {
      return res.status(503).json({ success: false, error: 'Registration is temporarily disabled due to system maintenance.' });
    }

    const {
      fullName, email, password, phone, idNumber, idPhotoUrl,
      majorId, levelId, collegeId, captchaAnswer, captchaChallengeId, otpCode, googleIdToken
    } = req.body;

    if (!fullName || !email || !phone || !majorId || !levelId || !collegeId) {
      return res.status(400).json({ success: false, error: 'Name, email, phone, and academic selections are required' });
    }

    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length < 3) {
      return res.status(400).json({ success: false, error: 'يجب إدخال الاسم الثلاثي أو الرباعي على الأقل' });
    }

    const suffix = phone.replace('+967', '');
    if (suffix.length !== 9 || !/^\d+$/.test(suffix)) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف يجب أن يتكون من 9 أرقام بعد الرمز الدولي' });
    }

    if (idNumber && idNumber.trim() !== '') {
      if (!/^\d+$/.test(idNumber.trim()) || idNumber.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'الرقم الجامعي يجب أن يتكون من أرقام فقط ولا يقل عن 5 خانات' });
      }
    }

    const resolvedId = (idNumber && idNumber.trim() !== '') ? idNumber.trim() : 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Verify CAPTCHA if provided
    if (captchaChallengeId || captchaAnswer) {
      const storedCaptcha = captchaStore.get(captchaChallengeId);
      if (!storedCaptcha) {
        return res.status(400).json({ success: false, error: 'كود التحقق البشري غير صالح أو منتهي الصلاحية' });
      }
      if (storedCaptcha.expires < Date.now()) {
        captchaStore.delete(captchaChallengeId);
        return res.status(400).json({ success: false, error: 'كود التحقق البشري منتهي الصلاحية' });
      }
      if (parseInt(captchaAnswer) !== storedCaptcha.answer) {
        return res.status(400).json({ success: false, error: 'إجابة التحقق البشري غير صحيحة' });
      }
      captchaStore.delete(captchaChallengeId); // single-use
    }

    // Verify OTP if provided
    if (otpCode) {
      const storedOtp = otpStore.get(phone);
      if (!storedOtp) {
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) غير موجود أو غير صالح' });
      }
      if (storedOtp.expires < Date.now()) {
        otpStore.delete(phone);
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) منتهي الصلاحية' });
      }
      if (otpCode !== storedOtp.code) {
        return res.status(400).json({ success: false, error: 'رمز التحقق (OTP) غير صحيح' });
      }
      otpStore.delete(phone); // single-use
    }

    let isGoogleVerified = false;
    let verifiedEmail = email;
    let verification = null;

    if (googleIdToken) {
      verification = await verifyGoogleToken(googleIdToken);
      if (verification.verified) {
        isGoogleVerified = true;
        verifiedEmail = verification.email;
      } else {
        return res.status(401).json({ success: false, error: verification.error || 'Google token verification failed' });
      }
    }

    if (!isGoogleVerified) {
      return res.status(400).json({ success: false, error: 'Registration via email and password is disabled. Students must link their official university Google account to proceed.' });
    }

    let resolvedCollegeId = parseInt(collegeId);
    if (isNaN(resolvedCollegeId)) {
      const queryName = String(collegeId);
      const college = await prisma.college.findFirst({
        where: {
          OR: [
            { slug: queryName },
            { name: queryName },
            ...(queryName === 'بوابة الطالب الجامعي' ? [{ slug: 'almanar-main' }, { name: 'كلية المنار الجامعية' }] : [])
          ]
        }
      });
      if (!college) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected College name/slug' });
      }
      resolvedCollegeId = college.id;
    }

    let resolvedMajorId = parseInt(majorId);
    if (isNaN(resolvedMajorId)) {
      const major = await prisma.major.findFirst({
        where: { name: String(majorId) }
      });
      if (!major) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected Major name' });
      }
      resolvedMajorId = major.id;
    }

    let resolvedLevelId = parseInt(levelId);
    if (isNaN(resolvedLevelId)) {
      const level = await prisma.level.findFirst({
        where: { name: String(levelId) }
      });
      if (!level) {
        return res.status(400).json({ success: false, error: 'Could not resolve selected Level name' });
      }
      resolvedLevelId = level.id;
    }

    const existingStudent = await prisma.student.findFirst({
      where: { email: { equals: verifiedEmail, mode: 'insensitive' } }
    });
    if (existingStudent) {
      return res.status(400).json({ success: false, error: 'Email address is already registered' });
    }

    const existingPhone = await prisma.student.findUnique({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ success: false, error: 'Phone number is already registered' });
    }

    const existingIdNumber = await prisma.student.findUnique({ where: { idNumber: resolvedId } });
    if (existingIdNumber) {
      return res.status(400).json({ success: false, error: 'ID Number is already registered' });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const student = await prisma.student.create({
      data: {
        name: fullName,
        email: verifiedEmail,
        password: hashedPassword,
        googleId: isGoogleVerified ? verification.googleId : null,
        phone,
        idNumber: resolvedId,
        idPhotoUrl: idPhotoUrl || null,
        collegeId: resolvedCollegeId,
        majorId: resolvedMajorId,
        levelId: resolvedLevelId,
        isEmailVerified: true,
        isPhoneVerified: true
      }
    });

    const token = jwt.sign(
      { id: student.id, name: student.name, role: 'STUDENT', groupId: student.groupId, collegeId: student.collegeId },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Call session activity tracker
    try {
      const { recordLogin } = require('../services/sessionTracker');
      recordLogin(student, 'STUDENT');
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Student registered and logged in successfully.',
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
        groupId: student.groupId,
        collegeId: student.collegeId
      }
    });

  } catch (error) {
    console.error('[API] Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
});

// 8. POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { identifier, code, type } = req.body;

    if (!identifier || !code || !type) {
      return res.status(400).json({ success: false, error: 'Identifier, code, and verification type are required' });
    }

    if (type !== 'EMAIL' && type !== 'PHONE') {
      return res.status(400).json({ success: false, error: 'Invalid verification type' });
    }

    let student;
    if (type === 'EMAIL') {
      student = await prisma.student.findUnique({ where: { email: identifier } });
    } else {
      student = await prisma.student.findUnique({ where: { phone: identifier } });
    }

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found' });
    }

    const validCode = await prisma.verificationCode.findFirst({
      where: {
        studentId: student.id,
        code,
        type,
        expiresAt: { gte: new Date() }
      }
    });

    if (!validCode) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    await prisma.verificationCode.delete({ where: { id: validCode.id } });

    const updateData = type === 'EMAIL' ? { isEmailVerified: true } : { isPhoneVerified: true };
    const updatedStudent = await prisma.student.update({
      where: { id: student.id },
      data: updateData
    });

    if (updatedStudent.isEmailVerified && updatedStudent.isPhoneVerified) {
      const token = jwt.sign(
        { id: updatedStudent.id, name: updatedStudent.name, role: 'STUDENT', groupId: updatedStudent.groupId },
        JWT_SECRET,
        { expiresIn: '90d' }
      );

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Account fully verified and activated.',
        token,
        user: {
          id: updatedStudent.id,
          name: updatedStudent.name,
          email: updatedStudent.email,
          role: 'STUDENT',
          groupId: updatedStudent.groupId
        }
      });
    }

    res.status(200).json({
      success: true,
      verified: false,
      message: `${type} verification completed. Pending remaining step.`
    });

  } catch (error) {
    console.error('[API] Verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during verification' });
  }
});


module.exports = router;
