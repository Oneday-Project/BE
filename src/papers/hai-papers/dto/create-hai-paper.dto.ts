import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateHAIpaperDto {
    @IsOptional()
    @IsString()
    doi?: string;

    @IsString()
    title!: string;

    @IsArray()
    @IsString({ each: true })
    authors!: string[];

    @IsOptional()
    @IsString()
    academic_advisor?: string;

    @IsOptional()
    @IsString()
    department?: string;

    @IsString()
    abstract!: string;

    @IsString()
    publishedYear!: string;

    @IsString()
    pdfUrl!: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    researchFields?: string[];
}
