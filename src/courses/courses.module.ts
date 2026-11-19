import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesAccessGuard } from './courses-access.guard';
import { CoursesController, EnrollmentsController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [AuthModule],
  controllers: [CoursesController, EnrollmentsController],
  providers: [CoursesService, CoursesAccessGuard],
})
export class CoursesModule {}
