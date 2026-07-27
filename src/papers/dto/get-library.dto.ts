import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum LibraryTypeEnum {
  BOOKMARK = 'bookmark',
  READING = 'reading',
  COMPLETED = 'completed',
}

export class GetLibraryDto {
  @ApiProperty({
    enum: LibraryTypeEnum,
    description: '조회할 라이브러리 종류(북마크한 논문 / 읽고 있는 논문 / 다 읽은 논문)',
    example: LibraryTypeEnum.BOOKMARK,
  })
  @IsEnum(LibraryTypeEnum)
  type!: LibraryTypeEnum;

  @ApiPropertyOptional({
    description: '페이지네이션 페이지',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: '가져올 데이터 개수',
    example: 8,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  take: number = 8;
}
