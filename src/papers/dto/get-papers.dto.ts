import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class GetPapersDto extends BasePaginationDto{
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsString({ each: true }) // 배열의 각 요소가 string인지 검사
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    tags?: string[];

    @IsNumber()
    @IsOptional()
    yearRange?: number;

    @IsString()
    @IsOptional()
    startDate?: string;

    @IsString()
    @IsOptional()
    endDate?: string;
}