import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBoardCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
