import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAlumniPostDto {
  @ApiProperty({
    description: '게시물 제목',
    example: '학부 연구생부터 AI 대학원 진학까지',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description: '게시물 내용',
    example:
      '학부 연구생 경험을 시작으로 관심 연구 분야를 좁히고 대학원에 진학한 과정을 소개합니다.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description: '학번년도(입학년도)',
    example: 20,
  })
  @IsInt()
  @Min(0)
  admissionYear!: number;

  @ApiProperty({
    description: '졸업년도',
    example: 24,
  })
  @IsInt()
  @Min(0)
  graduationYear!: number;

  @ApiPropertyOptional({
    description: '진학한 대학원명(선택, 미입력 시 "비공개"로 저장)',
    example: '서울대학교',
  })
  @IsString()
  @IsOptional()
  gradSchoolName?: string;

  @ApiProperty({
    description: '진학한 대학원 학과명',
    example: 'AI 대학원',
  })
  @IsString()
  @IsNotEmpty()
  gradSchoolDept!: string;

  @ApiProperty({
    description: '분야 태그 id 목록(ResearchField, 다중 선택, 1개 이상)',
    example: [1, 3],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  researchFieldIds!: number[];
}
