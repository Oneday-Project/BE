import { Module } from '@nestjs/common';
import { PapersService } from './papers.service';
import { PapersController } from './papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Papers } from './entities/papers.entity';
import { CommonModule } from 'src/common/common.module';
import { Author } from './entities/author.entity';
import { ResearchField } from '../research-fields/entities/research-fields.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Papers,
      Author,
      ResearchField,
    ]),
    CommonModule,
  ],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
