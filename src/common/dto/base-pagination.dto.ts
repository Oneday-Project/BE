import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString } from "class-validator";

export class BasePaginationDto {
    @ApiPropertyOptional({
        description: '페이지네이션 페이지',
        example: 1, 
    })
    @IsInt()
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({
        description: '페이지네이션 커서',
        example: 'eyJ2YWx1ZXMiOnsiaW5mbHVlbmNlU2NvcmUiOjQ4NzN9LCJvcmRlciI6WyJpbmZsdWVuY2VTY29yZV9ERVNDIl19', 
    })
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
    order: string[] = [];

    @ApiPropertyOptional({
        description: '가져올 데이터 개수',
        example: 5, 
    })
    @IsInt()
    @IsOptional()
    take: number = 12; 
}