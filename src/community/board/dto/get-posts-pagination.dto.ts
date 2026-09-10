import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { BasePaginationDto } from 'src/common/dto/base-pagination.dto';
import { POST_ORDER_VALUES } from '../const/post-order.const';

export class GetPostsPaginationDto extends BasePaginationDto {
  // 정렬은 이 두 값만 허용한다. 부모 DTO의 order는 형식만 검사해서 없는 컬럼명이 오면
  // DB까지 내려가 500이 나는데, 여기서 허용값을 고정하면 잘못된 값은 400으로 걸린다.
  @ApiPropertyOptional({
    description:
      '정렬 기준(createdAt_DESC=최신순, likeCount_DESC=인기순). 비우면 최신순',
    enum: POST_ORDER_VALUES,
    isArray: true,
    example: ['createdAt_DESC'],
  })
  @IsArray()
  @IsIn(POST_ORDER_VALUES, { each: true })
  @IsOptional()
  order: string[] = ['createdAt_DESC'];

  @ApiPropertyOptional({
    description: '게시판 카테고리 id(비우면 전체 카테고리 조회)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  categoryId?: number;

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
