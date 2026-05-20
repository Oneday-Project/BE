import { Module } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { AiServicesController } from './ai-services.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { PapersModule } from 'src/papers/papers.module';
import { HaiPaperAiSummary } from './entities/hai-paper-ai-summaries.entity';
import { HaiPapersModule } from 'src/papers/hai-papers/hai-papers.module';
import { HaiPaper } from 'src/papers/entities/hai-papers.entity';
import { Paper } from 'src/papers/entities/papers.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaperAiSummary,
      HaiPaperAiSummary,
      Paper,
      HaiPaper,
    ]),
    PapersModule,
    HaiPapersModule,
  ],
  controllers: [AiServicesController],
  providers: [AiServicesService],
})
export class AiServicesModule {}
