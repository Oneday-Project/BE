import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MajorCoursesService } from './major-courses.service';
import { CreateMajorCourseDto } from './dto/create-major-course.dto';
import { UpdateMajorCourseDto } from './dto/update-major-course.dto';

@Controller('major-courses')
export class MajorCoursesController {
  constructor(
    private readonly majorCoursesService: MajorCoursesService
  ){}

  @Get()
  getAllCourses() {
    return this.majorCoursesService.getAllCourses();
  }

  @Post()
  createCourse(@Body() dto: CreateMajorCourseDto) {
    return this.majorCoursesService.createCourse(dto);
  }

  @Patch(':courseId')
  updateCourse(
    @Param('courseId') id: string, 
    @Body() dto: UpdateMajorCourseDto,
  ){
    return this.majorCoursesService.updateCourse(id, dto);
  }

  @Delete(':courseId')
  deleteCourse(@Param('courseId') id: string) {
    return this.majorCoursesService.deleteCourse(id);
  }
}
