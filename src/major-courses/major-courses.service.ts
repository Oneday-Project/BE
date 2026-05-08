import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
    const courseExists = await this.majorCourseRepository.exists({
      where: {
          course_id: dto.course_id,
      }
    });

    if(courseExists){
      throw new ConflictException('이미 존재하는 전공과목 입니다!')
    }
    
    const paper = this.majorCourseRepository.create(dto);
    return this.majorCourseRepository.save(paper);
  }

  async getAllCourses() {
    return this.majorCourseRepository.find();
  }

  async updateCourse(course_id: string, dto: UpdateMajorCourseDto) {
    const courseExists = await this.majorCourseRepository.exists({
      where: {
          course_id,
      }
    });

    if(!courseExists){
      throw new BadRequestException('존재하지 않는 전공과목 입니다!')
    }

    await this.majorCourseRepository.update(course_id, dto);
    return this.majorCourseRepository.findOne({
      where: {
        course_id,
      } 
    }); 
  }

  async deleteCourse(course_id: string) {
    const courseExists = await this.majorCourseRepository.exists({
      where: {
          course_id,
      }
    });

    if(!courseExists){
      throw new BadRequestException('존재하지 않는 전공과목 입니다!')
    }

    await this.majorCourseRepository.delete(course_id);

    return course_id;
  }
}
