-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('THEORY', 'PRACTICAL');
CREATE TYPE "DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');
CREATE TYPE "OverrideType" AS ENUM ('TEMPORARY', 'PERMANENT');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'UNI_ADMIN', 'COLLEGE_ADMIN');
CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');
CREATE TYPE "PostCategory" AS ENUM ('QUESTION', 'RESOURCE', 'HELP', 'GENERAL');

-- CreateTable
CREATE TABLE "Governorate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Governorate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "University" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "themeColor" TEXT,
  "governorateId" TEXT,
  CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "College" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "location" TEXT,
  "universityId" INTEGER NOT NULL,
  CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Department" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Major" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "departmentId" INTEGER NOT NULL,
  CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Level" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Group" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "majorId" INTEGER,
  "levelId" INTEGER,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "idNumber" TEXT NOT NULL,
  "idPhotoUrl" TEXT,
  "phone" TEXT NOT NULL,
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT true,
  "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "isRepresentative" BOOLEAN NOT NULL DEFAULT false,
  "password" TEXT,
  "googleId" TEXT,
  "collegeId" INTEGER NOT NULL,
  "majorId" INTEGER NOT NULL,
  "levelId" INTEGER NOT NULL,
  "groupId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subject" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "SubjectType" NOT NULL,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lecturer" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Lecturer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Schedule" (
  "id" SERIAL NOT NULL,
  "subjectId" INTEGER NOT NULL,
  "roomId" INTEGER NOT NULL,
  "lecturerName" TEXT NOT NULL,
  "lecturerId" INTEGER,
  "groupId" INTEGER NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RescheduleRequest" (
  "id" SERIAL NOT NULL,
  "scheduleId" INTEGER NOT NULL,
  "lecturerId" INTEGER NOT NULL,
  "requestType" TEXT NOT NULL,
  "newDayOfWeek" "DayOfWeek",
  "newStartTime" TEXT,
  "newEndTime" TEXT,
  "newRoomId" INTEGER,
  "reason" TEXT,
  "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleOverride" (
  "id" SERIAL NOT NULL,
  "scheduleId" INTEGER NOT NULL,
  "newStartTime" TEXT,
  "newEndTime" TEXT,
  "newRoomId" INTEGER,
  "date" TIMESTAMP(3) NOT NULL,
  "overrideType" "OverrideType" NOT NULL,
  CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER,
  "groupId" INTEGER,
  "message" TEXT NOT NULL,
  "sentTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "NotificationStatus" NOT NULL,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Admin" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
  "collegeId" INTEGER,
  "universityId" INTEGER,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationCode" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "type" "VerificationType" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER,
  "adminId" INTEGER,
  "lecturerId" INTEGER,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER NOT NULL,
  "scheduleId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamSchedule" (
  "id" SERIAL NOT NULL,
  "subjectId" INTEGER NOT NULL,
  "roomId" INTEGER NOT NULL,
  "groupId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "collegeId" INTEGER NOT NULL,
  CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeatAllocation" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER NOT NULL,
  "examScheduleId" INTEGER NOT NULL,
  "seatNumber" TEXT NOT NULL,
  CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "scheduleId" INTEGER NOT NULL,
  "recordedById" INTEGER NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupResource" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "groupId" INTEGER NOT NULL,
  "postedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantConfig" (
  "id" SERIAL NOT NULL,
  "universityId" INTEGER,
  "collegeId" INTEGER,
  "themeColor" TEXT,
  "logoUrl" TEXT,
  "customDomain" TEXT,
  "enabledFeatures" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangePost" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" "PostCategory" NOT NULL DEFAULT 'GENERAL',
  "groupId" INTEGER NOT NULL,
  "studentId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExchangePost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExchangeComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExchangeComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Feedback" (
  "id" SERIAL NOT NULL,
  "studentId" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "category" TEXT,
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Defaults for Prisma uuid() fields
ALTER TABLE "Governorate" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "Attendance" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "GroupResource" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "ExchangePost" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "ExchangeComment" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;

-- CreateIndex
CREATE UNIQUE INDEX "Governorate_name_key" ON "Governorate"("name");
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");
CREATE INDEX "University_governorateId_idx" ON "University"("governorateId");
CREATE UNIQUE INDEX "College_slug_key" ON "College"("slug");
CREATE INDEX "College_universityId_idx" ON "College"("universityId");
CREATE INDEX "Department_collegeId_idx" ON "Department"("collegeId");
CREATE INDEX "Major_departmentId_idx" ON "Major"("departmentId");
CREATE INDEX "Group_majorId_idx" ON "Group"("majorId");
CREATE INDEX "Group_levelId_idx" ON "Group"("levelId");
CREATE INDEX "Group_collegeId_idx" ON "Group"("collegeId");
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");
CREATE UNIQUE INDEX "Student_idNumber_key" ON "Student"("idNumber");
CREATE UNIQUE INDEX "Student_phone_key" ON "Student"("phone");
CREATE UNIQUE INDEX "Student_googleId_key" ON "Student"("googleId");
CREATE INDEX "Student_collegeId_idx" ON "Student"("collegeId");
CREATE INDEX "Student_majorId_idx" ON "Student"("majorId");
CREATE INDEX "Student_levelId_idx" ON "Student"("levelId");
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");
CREATE INDEX "Subject_collegeId_idx" ON "Subject"("collegeId");
CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
CREATE INDEX "Room_collegeId_idx" ON "Room"("collegeId");
CREATE UNIQUE INDEX "Lecturer_email_key" ON "Lecturer"("email");
CREATE INDEX "Lecturer_collegeId_idx" ON "Lecturer"("collegeId");
CREATE INDEX "Schedule_groupId_idx" ON "Schedule"("groupId");
CREATE INDEX "Schedule_collegeId_idx" ON "Schedule"("collegeId");
CREATE INDEX "Schedule_lecturerId_idx" ON "Schedule"("lecturerId");
CREATE INDEX "Schedule_dayOfWeek_idx" ON "Schedule"("dayOfWeek");
CREATE INDEX "RescheduleRequest_scheduleId_idx" ON "RescheduleRequest"("scheduleId");
CREATE INDEX "RescheduleRequest_lecturerId_idx" ON "RescheduleRequest"("lecturerId");
CREATE INDEX "ScheduleOverride_scheduleId_idx" ON "ScheduleOverride"("scheduleId");
CREATE INDEX "ScheduleOverride_date_idx" ON "ScheduleOverride"("date");
CREATE INDEX "NotificationLog_studentId_idx" ON "NotificationLog"("studentId");
CREATE INDEX "NotificationLog_groupId_idx" ON "NotificationLog"("groupId");
CREATE INDEX "NotificationLog_sentTime_idx" ON "NotificationLog"("sentTime");
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE INDEX "Admin_collegeId_idx" ON "Admin"("collegeId");
CREATE INDEX "Admin_universityId_idx" ON "Admin"("universityId");
CREATE INDEX "VerificationCode_studentId_idx" ON "VerificationCode"("studentId");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_studentId_idx" ON "PushSubscription"("studentId");
CREATE INDEX "PushSubscription_adminId_idx" ON "PushSubscription"("adminId");
CREATE INDEX "PushSubscription_lecturerId_idx" ON "PushSubscription"("lecturerId");
CREATE UNIQUE INDEX "AttendanceRecord_studentId_scheduleId_date_key" ON "AttendanceRecord"("studentId", "scheduleId", "date");
CREATE INDEX "AttendanceRecord_scheduleId_date_idx" ON "AttendanceRecord"("scheduleId", "date");
CREATE INDEX "ExamSchedule_groupId_idx" ON "ExamSchedule"("groupId");
CREATE INDEX "ExamSchedule_collegeId_idx" ON "ExamSchedule"("collegeId");
CREATE INDEX "ExamSchedule_date_idx" ON "ExamSchedule"("date");
CREATE UNIQUE INDEX "SeatAllocation_studentId_examScheduleId_key" ON "SeatAllocation"("studentId", "examScheduleId");
CREATE UNIQUE INDEX "SeatAllocation_examScheduleId_seatNumber_key" ON "SeatAllocation"("examScheduleId", "seatNumber");
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX "Attendance_scheduleId_date_idx" ON "Attendance"("scheduleId", "date");
CREATE INDEX "GroupResource_groupId_createdAt_idx" ON "GroupResource"("groupId", "createdAt");
CREATE UNIQUE INDEX "TenantConfig_universityId_key" ON "TenantConfig"("universityId");
CREATE UNIQUE INDEX "TenantConfig_collegeId_key" ON "TenantConfig"("collegeId");
CREATE INDEX "ExchangePost_groupId_idx" ON "ExchangePost"("groupId");
CREATE INDEX "ExchangePost_studentId_idx" ON "ExchangePost"("studentId");
CREATE INDEX "ExchangeComment_postId_idx" ON "ExchangeComment"("postId");
CREATE INDEX "ExchangeComment_studentId_idx" ON "ExchangeComment"("studentId");
CREATE INDEX "Feedback_studentId_idx" ON "Feedback"("studentId");

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "College" ADD CONSTRAINT "College_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Major" ADD CONSTRAINT "Major_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lecturer" ADD CONSTRAINT "Lecturer_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupResource" ADD CONSTRAINT "GroupResource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangePost" ADD CONSTRAINT "ExchangePost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangePost" ADD CONSTRAINT "ExchangePost_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeComment" ADD CONSTRAINT "ExchangeComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ExchangePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeComment" ADD CONSTRAINT "ExchangeComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
