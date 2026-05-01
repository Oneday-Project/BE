import { Module } from '@nestjs/common';
import { PapersService } from './papers.service';
import { PapersController } from './papers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Papers } from './entities/papers.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Papers,
    ]),
    CommonModule,
  ],
  controllers: [PapersController],
  providers: [PapersService],
})
export class PapersModule {}
