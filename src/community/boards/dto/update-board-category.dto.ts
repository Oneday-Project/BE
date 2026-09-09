import { PartialType } from '@nestjs/mapped-types';
import { CreateBoardCategoryDto } from './create-board-category.dto';

export class UpdateBoardCategoryDto extends PartialType(
  CreateBoardCategoryDto,
) {}
