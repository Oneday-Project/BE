import { IsOptional, IsString } from 'class-validator';

export class UpdateResearchFieldDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    tag?: string;
}
