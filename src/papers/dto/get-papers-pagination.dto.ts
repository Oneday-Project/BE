import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { BasePaginationDto } from "src/common/dto/base-pagination.dto";

export class GetPapersPaginationDto extends BasePaginationDto{
    @ApiPropertyOptional({
        description: '키워드(최소 2글자 이상)로 검색',
        example: 'imagenet', 
    })
    @IsString()
    @IsOptional()
    @MinLength(2, {
        message: "키워드는 최소 2글자 이상 입력하세요.",
    })
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


    @ApiPropertyOptional({
        description: '중요도 별점(1~3개)',
        example: 3, 
    })
    @IsNumber()
    @IsOptional()
    starTier?: number;


    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    // 들어가는 데이터 예시
    // [id_DESC, likeCount_DESC]
    order: string[] = ['publishedDate_DESC'];


    @ApiPropertyOptional({
        description: '읽기 완료한 논문 포함 여부(로그인 시에만 적용, 기본값 true=포함)',
        type: Boolean,
        default: true,
    })
    // 타입을 boolean으로 선언하면 ValidationPipe의 enableImplicitConversion이
    // 'false' 문자열도 Boolean('false')===true로 잘못 변환해버리는 문제가 있어
    // string | boolean으로 선언해 그 자동 변환 경로를 피하고 아래 Transform으로 직접 변환한다
    @Transform(({ value }) => value === 'false' ? false : value === 'true' ? true : value)
    @IsBoolean()
    @IsOptional()
    includeCompleted: string | boolean = true;
}