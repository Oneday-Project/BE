import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { BasePaginationDto } from 'src/common/dto/base-pagination.dto';

export class GetHaiPapersPaginationDto extends BasePaginationDto {
    @ApiPropertyOptional({
        description: '키워드(최소 2글자 이상)로 검색(제목/초록/저자)',
        example: 'imagenet',
    })
    @IsString()
    @IsOptional()
    @MinLength(2, {
        message: '키워드는 최소 2글자 이상 입력하세요.',
    })
    keyword?: string;


    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    tags?: string[];


    @ApiPropertyOptional({
        description: '연구실(department) 기반 검색(다중 선택 가능)',
        example: ['이의철 교수 연구실'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    department?: string[];


    @ApiPropertyOptional({
        description: '최근 N년으로 검색',
        example: 5,
    })
    @IsNumber()
    @IsOptional()
    yearRange?: number;


    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    order: string[] = ['publishedYear_DESC'];
}
