import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '게시물 제목',
    example: '대학원 컨택은 보통 언제부터 시작하나요?',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: '게시물 내용',
    example:
      '3학년 2학기인데 교수님께 메일을 보내도 너무 이르지 않을지 궁금해요.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description: '게시판 종류 id',
    example: 1,
  })
  @IsInt()
  categoryId!: number;
}
