import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: '댓글 내용',
    example:
      '저도 3학년 때부터 준비했어요! 미리 시작하는 거 전혀 이르지 않아요.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: '대댓글을 작성할 부모 댓글 id(최상위 댓글이면 생략)',
    example: 12,
  })
  @IsInt()
  @IsOptional()
  parentId?: number;
}
