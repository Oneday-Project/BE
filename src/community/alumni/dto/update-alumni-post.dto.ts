import { PartialType } from '@nestjs/mapped-types';
import { CreateAlumniPostDto } from './create-alumni-post.dto';

export class UpdateAlumniPostDto extends PartialType(CreateAlumniPostDto) {}
