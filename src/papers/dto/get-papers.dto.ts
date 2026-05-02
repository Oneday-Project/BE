import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class GetPapersDto extends BasePaginationDto{
    @IsString()
    @IsOptional()
    keyword?: string;

    @IsString({ each: true }) 
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