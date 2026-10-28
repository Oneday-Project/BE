import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { Paper } from 'src/papers/entities/papers.entity';
import { GradInfo } from 'src/grad-info/entities/grad-info.entity';
import { UserRoadmap } from 'src/roadmap/entities/user-roadmap.entity';

@Module({
  // GradInfo는 분야 태그(ManyToMany)를 조회하는 용도 — 조인 테이블 이름을 raw SQL에
  // 하드코딩하지 않기 위해 ORM으로 따로 읽는다.
  // UserRoadmap은 질문한 사용자의 준비도 진단 결과를 읽어 상담에 반영하기 위한 용도.
  imports: [TypeOrmModule.forFeature([Paper, GradInfo, UserRoadmap])],
  controllers: [ChatbotController],
  providers: [ChatbotService],
})
export class ChatbotModule {}
