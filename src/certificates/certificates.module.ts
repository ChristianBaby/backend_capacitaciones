import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';
import { CoursesAccessGuard } from '../courses/courses-access.guard';
@Module({imports:[AuthModule],controllers:[CertificatesController],providers:[CertificatesService,CoursesAccessGuard]})
export class CertificatesModule {}
