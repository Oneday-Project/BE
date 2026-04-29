import { Injectable } from '@nestjs/common';
import { CreateMajorCourseDto } from './dto/create-major-course.dto';
import { UpdateMajorCourseDto } from './dto/update-major-course.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MajorCourse } from './entities/major-course.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MajorCoursesService {
  constructor(
    @InjectRepository(MajorCourse)
    private readonly majorCourseRepository: Repository<MajorCourse>,
  ){}

  async createCourse(dto: CreateMajorCourseDto) {
    const paper = this.majorCourseRepository.create(dto);
    return this.majorCourseRepository.save(paper);
  }

  async getAllCourses() {
    return this.majorCourseRepository.find();
  }

  async updateCourse(course_id: string, dto: UpdateMajorCourseDto) {
    await this.majorCourseRepository.update(course_id, dto);
    return this.majorCourseRepository.findOne({
      where: {
        course_id,
      } 
    }); 
  }

  async deleteCourse(course_id: string) {
    await this.majorCourseRepository.delete(course_id);
  }
}
