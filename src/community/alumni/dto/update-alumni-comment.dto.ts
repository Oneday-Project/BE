import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateAlumniCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}
