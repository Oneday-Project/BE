import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HaiPapersService } from './hai-papers.service';
import { HaiPapersController } from './hai-papers.controller';
import { HaiPaper } from '../entities/hai-papers.entity';
import { HaiPaperBookmark } from '../entities/hai-paper-bookmarks.entity';
import { HaiPaperReadingStatus } from '../entities/hai-paper-reading-status.entity';
import { HaiPaperActivityLog } from '../entities/hai-paper-activity-log.entity';
import { PapersModule } from '../papers.module';
import { UsersModule } from 'src/users/users.module';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HaiPaper,
      HaiPaperBookmark,
      HaiPaperReadingStatus,
      HaiPaperActivityLog,
    ]),
    PapersModule,
    UsersModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [HaiPapersController],
  providers: [HaiPapersService],
  exports: [HaiPapersService],
})
export class HaiPapersModule {}
