import { IsNotEmpty, IsString } from 'class-validator';

export class CreateResearchFieldDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    tag!: string;
}
