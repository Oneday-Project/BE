import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MajorCoursesService } from './major-courses.service';
import { CreateMajorCourseDto } from './dto/create-major-course.dto';
import { UpdateMajorCourseDto } from './dto/update-major-course.dto';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import { RolesEnum } from 'src/users/const/roles.const';
import { Roles } from 'src/auth/decorator/roles.decorator';

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

  @Get(':courseId')
  @ApiOperation({
    description: 'courseId(과목 코드) 기반 전공과목 하나를 가져오는 API',
  })
  getCourseById(@Param('courseId') courseId: string) {
    return this.majorCoursesService.getCourseById(courseId);
  }

  @Post()
  @ApiExcludeEndpoint() // 관리자 전용 — Swagger 문서에 노출하지 않는다
  @Roles(RolesEnum.ADMIN)
  @ApiOperation({
    description: '휴먼과 전공과목을 생성하는 API(관리자 권한)', 
  })
  createCourse(@Body() dto: CreateMajorCourseDto) {
    return this.majorCoursesService.createCourse(dto);
  }

  @Patch(':courseId')
  @ApiExcludeEndpoint() // 관리자 전용 — Swagger 문서에 노출하지 않는다
  @Roles(RolesEnum.ADMIN)
  @ApiOperation({
    description: 'courseId(과목 코드) 기반 휴먼과 전공과목을 수정하는 API(관리자 권한)', 
  })
  updateCourse(
    @Param('courseId') id: string, 
    @Body() dto: UpdateMajorCourseDto,
  ){
    return this.majorCoursesService.updateCourse(id, dto);
  }

  @Delete(':courseId')
  @ApiExcludeEndpoint() // 관리자 전용 — Swagger 문서에 노출하지 않는다
  @Roles(RolesEnum.ADMIN)
  @ApiOperation({
    description: 'courseId(과목 코드) 기반 휴먼과 전공과목을 삭제하는 API(관리자 권한)', 
  })
  deleteCourse(@Param('courseId') courseId: string) {
    return this.majorCoursesService.deleteCourse(courseId);
  }
}
