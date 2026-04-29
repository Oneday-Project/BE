import { Module } from '@nestjs/common';
import { MajorCoursesService } from './major-courses.service';
import { MajorCoursesController } from './major-courses.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MajorCourse } from './entities/major-course.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
    [
      MajorCourse,
    ]
  )],
  controllers: [MajorCoursesController],
  providers: [MajorCoursesService],
})
export class MajorCoursesModule {}
