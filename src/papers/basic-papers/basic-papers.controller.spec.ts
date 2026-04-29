import { Test, TestingModule } from '@nestjs/testing';
import { BasicPapersController } from './basic-papers.controller';
import { BasicPapersService } from './basic-papers.service';

describe('BasicPapersController', () => {
  let controller: BasicPapersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BasicPapersController],
      providers: [BasicPapersService],
    }).compile();

    controller = module.get<BasicPapersController>(BasicPapersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
