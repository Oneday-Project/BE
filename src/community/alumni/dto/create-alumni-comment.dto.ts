import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAlumniCommentDto {
  @ApiProperty({
    description: '댓글 내용',
    example: '좋은 글 감사합니다! 저도 비슷한 고민을 하고 있었어요.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: '대댓글을 작성할 부모 댓글 id(최상위 댓글이면 생략)',
    example: 5,
  })
  @IsInt()
  @IsOptional()
  parentId?: number;
}
