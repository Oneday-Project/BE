import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HaiPapersService } from './hai-papers.service';
import { HaiPapersController } from './hai-papers.controller';
import { HAIpapers } from '../entities/hai-papers.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        HAIpapers,
      ]
  )],
  controllers: [HaiPapersController],
  providers: [HaiPapersService],
})
export class HaiPapersModule {}
