import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HaiPapersService } from './hai-papers.service';
import { HaiPapersController } from './hai-papers.controller';
import { HaiPaper } from '../entities/hai-papers.entity';
import { PapersModule } from '../papers.module';


@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        HaiPaper,
      ]
  ),
    PapersModule,
  ],
  controllers: [HaiPapersController],
  providers: [HaiPapersService],
  exports: [HaiPapersService],
})
export class HaiPapersModule {}
