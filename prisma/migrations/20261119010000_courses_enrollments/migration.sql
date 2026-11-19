CREATE TYPE "CourseType" AS ENUM ('COURSE', 'WORKSHOP', 'CONFERENCE');
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'CANCELLED');

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CourseType" NOT NULL DEFAULT 'COURSE',
    "category" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Course_capacity_positive" CHECK ("capacity" > 0),
    CONSTRAINT "Course_dates_ordered" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "CourseInstructor" (
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("courseId", "instructorId")
);

CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Course_status_startsAt_idx" ON "Course"("status", "startsAt");
CREATE INDEX "Course_category_idx" ON "Course"("category");
CREATE INDEX "CourseInstructor_instructorId_idx" ON "CourseInstructor"("instructorId");
CREATE UNIQUE INDEX "Enrollment_courseId_studentId_key" ON "Enrollment"("courseId", "studentId");
CREATE INDEX "Enrollment_studentId_status_idx" ON "Enrollment"("studentId", "status");
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment"("courseId", "status");

ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
