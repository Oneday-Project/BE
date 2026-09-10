import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlumniService } from './alumni.service';
import { AlumniController } from './alumni.controller';
import { CommonModule } from 'src/common/common.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { AlumniPost } from './entities/alumni-post.entity';
import { AlumniComment } from './entities/alumni-comment.entity';
import { AlumniPostLike } from './entities/alumni-post-like.entity';
import { AlumniCommentLike } from './entities/alumni-comment-like.entity';
import { AiServicesModule } from 'src/ai-services/ai-services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlumniPost,
      AlumniComment,
      AlumniPostLike,
      AlumniCommentLike,
      ResearchField,
    ]),
    CommonModule,
    UsersModule,
    AuthModule,
    AiServicesModule, // 게시물 작성·수정 시 챗봇 검색용 임베딩 생성
  ],
  controllers: [AlumniController],
  providers: [AlumniService],
})
export class AlumniModule {}
