import { Module } from '@nestjs/common';
import { ResearchFieldsService } from './research-fields.service';
import { ResearchFieldsController } from './research-fields.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResearchField } from './entities/research-fields.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResearchField,
    ]),
  ],
  controllers: [ResearchFieldsController],
  providers: [ResearchFieldsService],
})
export class ResearchFieldsModule {}
