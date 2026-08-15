const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

class IdentityResolver {
  /**
   * Determine accessible portals for a given canonical user
   */
  static getAccessiblePortals(user) {
    const roleKeys = (user.roles || []).map(ur => ur.role?.key || ur.role);
    const portals = [];

    if (roleKeys.includes('STUDENT') || roleKeys.includes('STUDENT_REPRESENTATIVE') || user.student) {
      portals.push({ key: 'STUDENT_PORTAL', name: 'Student Portal', route: '/student' });
    }

    if (roleKeys.includes('LECTURER') || user.lecturer) {
      portals.push({ key: 'LECTURER_PORTAL', name: 'Lecturer Portal', route: '/lecturer' });
    }

    if (
      roleKeys.includes('ADMIN') ||
      roleKeys.includes('COLLEGE_ADMIN') ||
      roleKeys.includes('UNI_ADMIN') ||
      roleKeys.includes('SUPER_ADMIN') ||
      roleKeys.includes('SYSTEM_OWNER') ||
      user.admin
    ) {
      portals.push({ key: 'ADMIN_PORTAL', name: 'Admin Portal', route: '/admin' });
      if (roleKeys.includes('SUPER_ADMIN') || roleKeys.includes('SYSTEM_OWNER')) {
        portals.push({ key: 'SUPER_ADMIN_PORTAL', name: 'Super Admin Portal', route: '/admin' });
      }
    }

    return portals;
  }

  /**
   * Resolve user by email/identifier and password
   */
  static async resolvePasswordIdentity(identifier, rawPassword) {
    const cleanId = identifier.trim();
    const normalizedEmail = cleanId.toLowerCase();

    // 1. Find User by email or linked profile fields (idNumber / phone)
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { emailNormalized: normalizedEmail },
          { email: cleanId },
          { student: { idNumber: cleanId } },
          { student: { phone: cleanId } }
        ]
      },
      include: {
        passwordCredential: true,
        roles: { include: { role: true } },
        student: { include: { college: true, major: true, level: true, group: true } },
        lecturer: { include: { college: true } },
        admin: { include: { college: true, university: true } }
      }
    });

    if (!user) {
      return { success: false, code: 'INVALID_CREDENTIALS', error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    if (!user.isActive) {
      return { success: false, code: 'ACCOUNT_DISABLED', error: 'الحساب معطل، يرجى التواصل مع الإدارة' };
    }

    // 2. Verify Password
    let passwordHash = user.passwordCredential?.passwordHash;

    // Fallback check against legacy profile table if credential row missing
    if (!passwordHash) {
      passwordHash = user.student?.password || user.lecturer?.password || user.admin?.password;
    }

    if (!passwordHash) {
      return { success: false, code: 'CREDENTIAL_NOT_SET', error: 'لم يتم تعيين كلمة مرور لهذا الحساب' };
    }

    const isValid = await bcrypt.compare(rawPassword, passwordHash);
    if (!isValid) {
      return { success: false, code: 'INVALID_CREDENTIALS', error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
    }

    // Upsert PasswordCredential if missing
    if (!user.passwordCredential) {
      await prisma.passwordCredential.upsert({
        where: { userId: user.id },
        update: { passwordHash },
        create: { userId: user.id, passwordHash }
      }).catch(err => console.error('[IdentityResolver] Failed to sync PasswordCredential:', err.message));
    }

    const portals = this.getAccessiblePortals(user);
    return { success: true, user, portals };
  }

  /**
   * Resolve user by Google OAuth claims
   */
  static async resolveGoogleIdentity(googleClaims) {
    const { googleId, email, name } = googleClaims;
    if (!googleId || !email) {
      return { success: false, code: 'GOOGLE_CLAIMS_INVALID', error: 'بيانات Google غير مكتملة' };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try finding AuthIdentity by providerAccountId
    let authIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleId
        }
      },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            student: true,
            lecturer: true,
            admin: true
          }
        }
      }
    });

    let user = authIdentity?.user;

    // 2. If not found, search User by normalized email
    if (!user) {
      user = await prisma.user.findFirst({
        where: { emailNormalized: normalizedEmail },
        include: {
          roles: { include: { role: true } },
          student: true,
          lecturer: true,
          admin: true
        }
      });
    }

    // 3. Link or create
    if (user) {
      // Link Google identity
      await prisma.authIdentity.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: googleId
          }
        },
        update: { userId: user.id, email: normalizedEmail },
        create: {
          userId: user.id,
          provider: 'google',
          providerAccountId: googleId,
          email: normalizedEmail
        }
      });
    } else {
      // Create new Student User
      const studentRole = await prisma.role.findUnique({ where: { key: 'STUDENT' } });
      user = await prisma.user.create({
        data: {
          email: email.trim(),
          emailNormalized: normalizedEmail,
          displayName: name || email.split('@')[0],
          authIdentities: {
            create: {
              provider: 'google',
              providerAccountId: googleId,
              email: normalizedEmail
            }
          },
          roles: studentRole ? {
            create: { roleId: studentRole.id }
          } : undefined
        },
        include: {
          roles: { include: { role: true } },
          student: true,
          lecturer: true,
          admin: true
        }
      });
    }

    const portals = this.getAccessiblePortals(user);
    return { success: true, user, portals };
  }
}

module.exports = IdentityResolver;
