import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { Paper } from 'src/papers/entities/papers.entity';
import { AlumniPost } from 'src/community/alumni/entities/alumni-post.entity';

@Module({
  // AlumniPost는 분야 태그(ManyToMany)를 조회하는 용도 — 조인 테이블 이름을 raw SQL에
  // 하드코딩하지 않기 위해 ORM으로 따로 읽는다.
  imports: [TypeOrmModule.forFeature([Paper, AlumniPost])],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
