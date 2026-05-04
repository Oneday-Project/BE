import { Module } from '@nestjs/common';
import { BasicPapersService } from './basic-papers.service';
import { BasicPapersController } from './basic-papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawArxiv } from '../entities/raw-arxiv.entity';
import { RawSemanticScholar } from '../entities/raw-semantic-scholar.entity';
import { Paper } from '../entities/papers.entity';
import { Author } from '../entities/authors.entity';
import { ResearchField } from '../../research-fields/entities/research-fields.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
    [
      RawArxiv,
      RawSemanticScholar,
      Paper,
      Author,   
      ResearchField, 
    ]
  )],
  controllers: [BasicPapersController],
  providers: [BasicPapersService],
})
export class BasicPapersModule {}
