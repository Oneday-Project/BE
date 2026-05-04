import { Module } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { AiServicesController } from './ai-services.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { PapersModule } from 'src/papers/papers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaperAiSummary,
    ]),
    PapersModule,
  ],
  controllers: [AiServicesController],
  providers: [AiServicesService],
})
export class AiServicesModule {}
