-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'UNI_ADMIN', 'COLLEGE_ADMIN');

-- CreateEnum
CREATE TYPE "public"."AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "public"."DayOfWeek" AS ENUM ('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateEnum
CREATE TYPE "public"."GoalType" AS ENUM ('ASSIGNMENT', 'PROJECT', 'EXAM', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."OverrideType" AS ENUM ('TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "public"."PostCategory" AS ENUM ('QUESTION', 'RESOURCE', 'HELP', 'GENERAL', 'POLL');

-- CreateEnum
CREATE TYPE "public"."RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SubjectType" AS ENUM ('THEORY', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "public"."VerificationType" AS ENUM ('EMAIL', 'PHONE');

-- CreateTable
CREATE TABLE "public"."AcademicGoal" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."GoalType" NOT NULL DEFAULT 'ASSIGNMENT',
    "dueDate" TIMESTAMP(3),
    "weekNumber" INTEGER,
    "subjectId" INTEGER NOT NULL,
    "groupId" INTEGER,
    "scheduleId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL DEFAULT 'ADMIN',
    "collegeId" INTEGER,
    "universityId" INTEGER,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "recordedById" INTEGER NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceRecord" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "public"."AttendanceStatus" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER,
    "userEmail" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlockedIP" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."College" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "universityId" INTEGER NOT NULL,

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "collegeId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExamSchedule" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "collegeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExchangeComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExchangePost" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "public"."PostCategory" NOT NULL DEFAULT 'GENERAL',
    "groupId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Feedback" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Governorate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Governorate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "majorId" INTEGER,
    "levelId" INTEGER,
    "collegeId" INTEGER NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GroupResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "postedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InsightLog" (
    "id" SERIAL NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "InsightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lecturer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "collegeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lecturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Level" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Major" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER,
    "groupId" INTEGER,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "sentTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "deviceToken" TEXT,
    "platform" TEXT,
    "status" "public"."NotificationStatus" NOT NULL,
    "broadcastId" TEXT,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Poll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PollVote" (
    "id" SERIAL NOT NULL,
    "pollId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "optionIdx" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushSubscription" (
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

-- CreateTable
CREATE TABLE "public"."RescheduleRequest" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "lecturerId" INTEGER NOT NULL,
    "requestType" TEXT NOT NULL,
    "newDayOfWeek" "public"."DayOfWeek",
    "newStartTime" TEXT,
    "newEndTime" TEXT,
    "newRoomId" INTEGER,
    "reason" TEXT,
    "status" "public"."RequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "collegeId" INTEGER NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Schedule" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "roomId" INTEGER NOT NULL,
    "lecturerName" TEXT NOT NULL,
    "lecturerId" INTEGER,
    "groupId" INTEGER NOT NULL,
    "collegeId" INTEGER NOT NULL,
    "dayOfWeek" "public"."DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleOverride" (
    "id" SERIAL NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "newStartTime" TEXT,
    "newEndTime" TEXT,
    "newRoomId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "overrideType" "public"."OverrideType" NOT NULL,

    CONSTRAINT "ScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeatAllocation" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "examScheduleId" INTEGER NOT NULL,
    "seatNumber" TEXT NOT NULL,

    CONSTRAINT "SeatAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionLog" (
    "id" SERIAL NOT NULL,
    "userEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),
    "devicePlatform" TEXT,
    "ipAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "deviceOs" TEXT,
    "browser" TEXT,
    "appVersion" TEXT,
    "country" TEXT,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Student" (
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
    "xp" INTEGER NOT NULL DEFAULT 350,
    "streak" INTEGER NOT NULL DEFAULT 7,
    "lastLoginDate" TIMESTAMP(3),
    "isFocusing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentGoalCompletion" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "academicGoalId" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "StudentGoalCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentTask" (
    "id" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'PERSONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."SubjectType" NOT NULL,
    "collegeId" INTEGER NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantConfig" (
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

-- CreateTable
CREATE TABLE "public"."University" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "themeColor" TEXT,
    "governorateId" TEXT,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationCode" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."VerificationType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicGoal_groupId_idx" ON "public"."AcademicGoal"("groupId" ASC);

-- CreateIndex
CREATE INDEX "AcademicGoal_scheduleId_idx" ON "public"."AcademicGoal"("scheduleId" ASC);

-- CreateIndex
CREATE INDEX "AcademicGoal_subjectId_idx" ON "public"."AcademicGoal"("subjectId" ASC);

-- CreateIndex
CREATE INDEX "Admin_collegeId_idx" ON "public"."Admin"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email" ASC);

-- CreateIndex
CREATE INDEX "Admin_universityId_idx" ON "public"."Admin"("universityId" ASC);

-- CreateIndex
CREATE INDEX "Attendance_scheduleId_date_idx" ON "public"."Attendance"("scheduleId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "public"."Attendance"("studentId" ASC);

-- CreateIndex
CREATE INDEX "AttendanceRecord_scheduleId_date_idx" ON "public"."AttendanceRecord"("scheduleId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_scheduleId_date_key" ON "public"."AttendanceRecord"("studentId" ASC, "scheduleId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "public"."AuditLog"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userEmail_idx" ON "public"."AuditLog"("userEmail" ASC);

-- CreateIndex
CREATE INDEX "BlockedIP_ip_idx" ON "public"."BlockedIP"("ip" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIP_ip_key" ON "public"."BlockedIP"("ip" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "College_slug_key" ON "public"."College"("slug" ASC);

-- CreateIndex
CREATE INDEX "College_universityId_idx" ON "public"."College"("universityId" ASC);

-- CreateIndex
CREATE INDEX "Department_collegeId_idx" ON "public"."Department"("collegeId" ASC);

-- CreateIndex
CREATE INDEX "ExamSchedule_collegeId_idx" ON "public"."ExamSchedule"("collegeId" ASC);

-- CreateIndex
CREATE INDEX "ExamSchedule_date_idx" ON "public"."ExamSchedule"("date" ASC);

-- CreateIndex
CREATE INDEX "ExamSchedule_groupId_idx" ON "public"."ExamSchedule"("groupId" ASC);

-- CreateIndex
CREATE INDEX "ExchangeComment_postId_idx" ON "public"."ExchangeComment"("postId" ASC);

-- CreateIndex
CREATE INDEX "ExchangeComment_studentId_idx" ON "public"."ExchangeComment"("studentId" ASC);

-- CreateIndex
CREATE INDEX "ExchangePost_groupId_idx" ON "public"."ExchangePost"("groupId" ASC);

-- CreateIndex
CREATE INDEX "ExchangePost_studentId_idx" ON "public"."ExchangePost"("studentId" ASC);

-- CreateIndex
CREATE INDEX "Feedback_studentId_idx" ON "public"."Feedback"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Governorate_name_key" ON "public"."Governorate"("name" ASC);

-- CreateIndex
CREATE INDEX "Group_collegeId_idx" ON "public"."Group"("collegeId" ASC);

-- CreateIndex
CREATE INDEX "Group_levelId_idx" ON "public"."Group"("levelId" ASC);

-- CreateIndex
CREATE INDEX "Group_majorId_idx" ON "public"."Group"("majorId" ASC);

-- CreateIndex
CREATE INDEX "GroupResource_groupId_createdAt_idx" ON "public"."GroupResource"("groupId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "InsightLog_generatedAt_idx" ON "public"."InsightLog"("generatedAt" ASC);

-- CreateIndex
CREATE INDEX "Lecturer_collegeId_idx" ON "public"."Lecturer"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Lecturer_email_key" ON "public"."Lecturer"("email" ASC);

-- CreateIndex
CREATE INDEX "Major_departmentId_idx" ON "public"."Major"("departmentId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_broadcastId_idx" ON "public"."NotificationLog"("broadcastId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_groupId_idx" ON "public"."NotificationLog"("groupId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_sentTime_idx" ON "public"."NotificationLog"("sentTime" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "public"."NotificationLog"("status" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_studentId_idx" ON "public"."NotificationLog"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Poll_postId_key" ON "public"."Poll"("postId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_studentId_key" ON "public"."PollVote"("pollId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_adminId_idx" ON "public"."PushSubscription"("adminId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "public"."PushSubscription"("endpoint" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_lecturerId_idx" ON "public"."PushSubscription"("lecturerId" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_studentId_idx" ON "public"."PushSubscription"("studentId" ASC);

-- CreateIndex
CREATE INDEX "RescheduleRequest_lecturerId_idx" ON "public"."RescheduleRequest"("lecturerId" ASC);

-- CreateIndex
CREATE INDEX "RescheduleRequest_scheduleId_idx" ON "public"."RescheduleRequest"("scheduleId" ASC);

-- CreateIndex
CREATE INDEX "Room_collegeId_idx" ON "public"."Room"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_key" ON "public"."Room"("name" ASC);

-- CreateIndex
CREATE INDEX "Schedule_collegeId_idx" ON "public"."Schedule"("collegeId" ASC);

-- CreateIndex
CREATE INDEX "Schedule_dayOfWeek_idx" ON "public"."Schedule"("dayOfWeek" ASC);

-- CreateIndex
CREATE INDEX "Schedule_groupId_idx" ON "public"."Schedule"("groupId" ASC);

-- CreateIndex
CREATE INDEX "Schedule_lecturerId_idx" ON "public"."Schedule"("lecturerId" ASC);

-- CreateIndex
CREATE INDEX "ScheduleOverride_date_idx" ON "public"."ScheduleOverride"("date" ASC);

-- CreateIndex
CREATE INDEX "ScheduleOverride_scheduleId_idx" ON "public"."ScheduleOverride"("scheduleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_examScheduleId_seatNumber_key" ON "public"."SeatAllocation"("examScheduleId" ASC, "seatNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SeatAllocation_studentId_examScheduleId_key" ON "public"."SeatAllocation"("studentId" ASC, "examScheduleId" ASC);

-- CreateIndex
CREATE INDEX "SessionLog_loginTime_idx" ON "public"."SessionLog"("loginTime" ASC);

-- CreateIndex
CREATE INDEX "SessionLog_userEmail_idx" ON "public"."SessionLog"("userEmail" ASC);

-- CreateIndex
CREATE INDEX "Student_collegeId_idx" ON "public"."Student"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "public"."Student"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_googleId_key" ON "public"."Student"("googleId" ASC);

-- CreateIndex
CREATE INDEX "Student_groupId_idx" ON "public"."Student"("groupId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_idNumber_key" ON "public"."Student"("idNumber" ASC);

-- CreateIndex
CREATE INDEX "Student_levelId_idx" ON "public"."Student"("levelId" ASC);

-- CreateIndex
CREATE INDEX "Student_majorId_idx" ON "public"."Student"("majorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Student_phone_key" ON "public"."Student"("phone" ASC);

-- CreateIndex
CREATE INDEX "StudentGoalCompletion_academicGoalId_idx" ON "public"."StudentGoalCompletion"("academicGoalId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StudentGoalCompletion_studentId_academicGoalId_key" ON "public"."StudentGoalCompletion"("studentId" ASC, "academicGoalId" ASC);

-- CreateIndex
CREATE INDEX "StudentGoalCompletion_studentId_idx" ON "public"."StudentGoalCompletion"("studentId" ASC);

-- CreateIndex
CREATE INDEX "StudentTask_studentId_idx" ON "public"."StudentTask"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "public"."Subject"("code" ASC);

-- CreateIndex
CREATE INDEX "Subject_collegeId_idx" ON "public"."Subject"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_collegeId_key" ON "public"."TenantConfig"("collegeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_universityId_key" ON "public"."TenantConfig"("universityId" ASC);

-- CreateIndex
CREATE INDEX "University_governorateId_idx" ON "public"."University"("governorateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "public"."University"("slug" ASC);

-- CreateIndex
CREATE INDEX "VerificationCode_studentId_idx" ON "public"."VerificationCode"("studentId" ASC);

-- AddForeignKey
ALTER TABLE "public"."AcademicGoal" ADD CONSTRAINT "AcademicGoal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AcademicGoal" ADD CONSTRAINT "AcademicGoal_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AcademicGoal" ADD CONSTRAINT "AcademicGoal_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Admin" ADD CONSTRAINT "Admin_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Admin" ADD CONSTRAINT "Admin_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."College" ADD CONSTRAINT "College_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExamSchedule" ADD CONSTRAINT "ExamSchedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExchangeComment" ADD CONSTRAINT "ExchangeComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."ExchangePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExchangeComment" ADD CONSTRAINT "ExchangeComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExchangePost" ADD CONSTRAINT "ExchangePost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExchangePost" ADD CONSTRAINT "ExchangePost_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "public"."Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "public"."Major"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GroupResource" ADD CONSTRAINT "GroupResource_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lecturer" ADD CONSTRAINT "Lecturer_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Major" ADD CONSTRAINT "Major_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationLog" ADD CONSTRAINT "NotificationLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Poll" ADD CONSTRAINT "Poll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."ExchangePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public"."Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PollVote" ADD CONSTRAINT "PollVote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "public"."Lecturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "public"."Lecturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "public"."Lecturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleOverride" ADD CONSTRAINT "ScheduleOverride_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatAllocation" ADD CONSTRAINT "SeatAllocation_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES "public"."ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeatAllocation" ADD CONSTRAINT "SeatAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "public"."Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "public"."Major"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentGoalCompletion" ADD CONSTRAINT "StudentGoalCompletion_academicGoalId_fkey" FOREIGN KEY ("academicGoalId") REFERENCES "public"."AcademicGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentGoalCompletion" ADD CONSTRAINT "StudentGoalCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentTask" ADD CONSTRAINT "StudentTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subject" ADD CONSTRAINT "Subject_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantConfig" ADD CONSTRAINT "TenantConfig_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "public"."College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantConfig" ADD CONSTRAINT "TenantConfig_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "public"."University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."University" ADD CONSTRAINT "University_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "public"."Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationCode" ADD CONSTRAINT "VerificationCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

