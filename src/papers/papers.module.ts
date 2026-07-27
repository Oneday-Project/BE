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
import { HaiPaper } from './entities/hai-papers.entity';
import { HaiPaperBookmark } from './entities/hai-paper-bookmarks.entity';
import { HaiPaperReadingStatus } from './entities/hai-paper-reading-status.entity';
import { HaiPaperActivityLog } from './entities/hai-paper-activity-log.entity';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Paper,
      Author,
      ResearchField,
      PaperBookmark,
      PaperReadingStatus,
      ReadingActivityLog,
      // 캘린더/이어서읽기 통합 조회를 위해 HaiPaper 관련 엔티티도 직접 등록(HaiPapersModule은 import하지 않음 - 순환 의존 방지)
      HaiPaper,
      HaiPaperBookmark,
      HaiPaperReadingStatus,
      HaiPaperActivityLog,
    ]),
    CommonModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
