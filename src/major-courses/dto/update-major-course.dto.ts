import { PartialType } from '@nestjs/mapped-types';
import { CreateMajorCourseDto } from './create-major-course.dto';

export class UpdateMajorCourseDto extends PartialType(CreateMajorCourseDto) {}
