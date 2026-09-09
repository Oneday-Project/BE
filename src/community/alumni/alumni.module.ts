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
  ],
  controllers: [AlumniController],
  providers: [AlumniService],
})
export class AlumniModule {}
