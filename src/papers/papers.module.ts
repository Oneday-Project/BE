import { Module } from '@nestjs/common';
import { PapersService } from './papers.service';
import { PapersController } from './papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paper } from './entities/papers.entity';
import { CommonModule } from 'src/common/common.module';
import { Author } from './entities/authors.entity';
import { ResearchField } from '../research-fields/entities/research-fields.entity';
import { PaperBookmark } from './entities/paper-bookmarks.entity';
import { PaperReadingStatus } from './entities/paper-reading-status.entity';
import { ReadingActivityLog } from './entities/reading-activity-log.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Paper,
      Author,
      ResearchField,
      PaperBookmark,
      PaperReadingStatus,
      ReadingActivityLog,
    ]),
    CommonModule,
    UsersModule,
  ],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
