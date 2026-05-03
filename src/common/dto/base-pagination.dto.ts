import { Transform } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString } from "class-validator";

export class BasePaginationDto {
    @IsInt()
    @IsOptional()
    page?: number;

    @IsString()
    @IsOptional()
    // 들어가는 데이터 예시
    // id_52, likeCount_20
    cursor?: string;

    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    // 들어가는 데이터 예시
    // [id_DESC, likeCount_DESC]
    order!: string[];

    @IsInt()
    @IsOptional()
    take: number = 12; 
}