import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapTask } from './entities/roadmap-task.entity';

@Module({
    imports: [TypeOrmModule.forFeature([RoadmapTask])],
    controllers: [RoadmapController],
    providers: [RoadmapService],
})
export class RoadmapModule {}
