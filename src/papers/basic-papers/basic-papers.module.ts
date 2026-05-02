import { Module } from '@nestjs/common';
import { BasicPapersService } from './basic-papers.service';
import { BasicPapersController } from './basic-papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawArxiv } from '../entities/raw-arxiv.entity';
import { RawSemanticScholar } from '../entities/raw-semantic-scholar.entity';
import { Papers } from '../entities/papers.entity';
// [변경] integrate() 에서 Author, Category FK 처리를 위해 레포지토리 추가
import { Author } from '../entities/author.entity';
import { ResearchField } from '../entities/research-fields.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
    [
      RawArxiv,
      RawSemanticScholar,
      Papers,
      Author,   // [변경] 저자 레포지토리 등록
      ResearchField, // [변경] 분야 레포지토리 등록
    ]
  )],
  controllers: [BasicPapersController],
  providers: [BasicPapersService],
})
export class BasicPapersModule {}
