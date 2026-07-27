import { IsOptional, IsString } from 'class-validator';

export class UpdateResearchFieldDto {
    @IsString()
    @IsOptional()
    tag?: string;
}
