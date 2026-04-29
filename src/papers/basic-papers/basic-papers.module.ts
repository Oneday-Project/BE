import { Module } from '@nestjs/common';
import { BasicPapersService } from './basic-papers.service';
import { BasicPapersController } from './basic-papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawArxiv } from '../entities/raw-arxiv.entity';
import { RawSemanticScholar } from '../entities/raw-semantic-scholar.entity';
import { Papers } from '../entities/papers.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature(
    [
      RawArxiv, 
      RawSemanticScholar, 
      Papers,
    ]
  )],
  controllers: [BasicPapersController],
  providers: [BasicPapersService],
})
export class BasicPapersModule {}
