import { IsOptional, IsString } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class GetPapersDto extends BasePaginationDto{
    @IsString()
    @IsOptional()
    title?: string;
}