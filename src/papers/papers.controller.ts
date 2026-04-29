import { Controller } from '@nestjs/common';
import { PapersService } from './papers.service';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}
}
