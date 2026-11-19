CREATE TABLE "TrainingSession" (
 "id" TEXT NOT NULL PRIMARY KEY, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "startsAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "qrHash" TEXT, "qrExpiresAt" TIMESTAMP(3),
 CONSTRAINT "TrainingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TrainingSession_qrHash_key" ON "TrainingSession"("qrHash");
CREATE INDEX "TrainingSession_courseId_idx" ON "TrainingSession"("courseId");
CREATE TABLE "Attendance" (
 "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "Attendance"("sessionId", "studentId");
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
