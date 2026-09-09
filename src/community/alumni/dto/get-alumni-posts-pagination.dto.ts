import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { BasePaginationDto } from 'src/common/dto/base-pagination.dto';

export class GetAlumniPostsPaginationDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description: '분야 태그(ResearchField) id(비우면 전체 태그 조회)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  researchFieldId?: number;

  @ApiPropertyOptional({
    description: '정렬 기준(latest=최신순, popular=인기순/좋아요순)',
    example: 'latest',
    enum: ['latest', 'popular'],
  })
  @IsIn(['latest', 'popular'])
  @IsOptional()
  sort: 'latest' | 'popular' = 'latest';

  @ApiPropertyOptional({
    description: '키워드(최소 2글자 이상)로 검색(제목/내용)',
    example: '대학원',
  })
  @IsString()
  @IsOptional()
  @MinLength(2, {
    message: '키워드는 최소 2글자 이상 입력하세요.',
  })
  keyword?: string;
}
