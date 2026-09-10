import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardService } from './board.service';
import { BoardController } from './board.controller';
import { CommonModule } from 'src/common/common.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { BoardCategory } from './entities/board-category.entity';
import { BoardPost } from './entities/board-post.entity';
import { BoardComment } from './entities/board-comment.entity';
import { BoardPostLike } from './entities/board-post-like.entity';
import { BoardCommentLike } from './entities/board-comment-like.entity';
import { AiServicesModule } from 'src/ai-services/ai-services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BoardCategory,
      BoardPost,
      BoardComment,
      BoardPostLike,
      BoardCommentLike,
    ]),
    CommonModule,
    UsersModule,
    AuthModule,
    AiServicesModule, // 게시물 작성·수정 시 챗봇 검색용 임베딩 생성
  ],
  controllers: [BoardController],
  providers: [BoardService],
})
export class BoardModule {}
