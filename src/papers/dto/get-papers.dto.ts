import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class GetPapersDto extends BasePaginationDto{
    @ApiPropertyOptional({
        description: '키워드로 검색',
        example: 'imagenet', 
    })
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsString({ each: true }) 
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    tags?: string[];

    @ApiPropertyOptional({
        description: '최근 N년으로 검색',
        example: 5, 
    })
    @IsNumber()
    @IsOptional()
    yearRange?: number;

    @ApiPropertyOptional({
        description: '시작일(기간 직접 입력) 검색',
        example: '2020-01-01', 
    })
    @IsString()
    @IsOptional()
    startDate?: string;

    @ApiPropertyOptional({
        description: '종료일(기간 직접 입력) 검색',
        example: '2025-12-31', 
    })
    @IsString()
    @IsOptional()
    endDate?: string;

    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    // 들어가는 데이터 예시
    // [id_DESC, likeCount_DESC]
    order: string[] = ['publishedDate_DESC'];
}