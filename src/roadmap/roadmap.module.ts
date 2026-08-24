import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapTask } from './entities/roadmap-task.entity';
import { UserRoadmap } from './entities/user-roadmap.entity';
import { AiServicesModule } from 'src/ai-services/ai-services.module';
import { MajorCourse } from 'src/major-courses/entities/major-course.entity';
import { PapersModule } from 'src/papers/papers.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsersModule } from 'src/users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([RoadmapTask, UserRoadmap, MajorCourse]),
        AiServicesModule,
        PapersModule,
        AuthModule,
        UsersModule,
    ],
    controllers: [RoadmapController],
    providers: [RoadmapService],
})
export class RoadmapModule {}
