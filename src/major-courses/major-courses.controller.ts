import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MajorCoursesService } from './major-courses.service';
import { CreateMajorCourseDto } from './dto/create-major-course.dto';
import { UpdateMajorCourseDto } from './dto/update-major-course.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('major-courses')
@ApiBearerAuth()
export class MajorCoursesController {
  constructor(
    private readonly majorCoursesService: MajorCoursesService
  ){}

  @Get()
  @ApiOperation({
    description: '모든 휴먼과 전공과목을 가져오는 API', 
  })
  getAllCourses() {
    return this.majorCoursesService.getAllCourses();
  }

  @Post()
  @ApiOperation({
    description: '휴먼과 전공과목을 생성하는 API', 
  })
  createCourse(@Body() dto: CreateMajorCourseDto) {
    return this.majorCoursesService.createCourse(dto);
  }

  @Patch(':courseId')
  @ApiOperation({
    description: 'courseId(과목 코드) 기반 휴먼과 전공과목을 수정하는 API', 
  })
  updateCourse(
    @Param('courseId') id: string, 
    @Body() dto: UpdateMajorCourseDto,
  ){
    return this.majorCoursesService.updateCourse(id, dto);
  }

  @Delete(':courseId')
  @ApiOperation({
    description: 'courseId(과목 코드) 기반 휴먼과 전공과목을 삭제하는 API', 
  })
  deleteCourse(@Param('courseId') id: string) {
    return this.majorCoursesService.deleteCourse(id);
  }
}
