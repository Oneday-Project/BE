import { Test, TestingModule } from '@nestjs/testing';
import { HaiPapersController } from './hai-papers.controller';
import { HaiPapersService } from './hai-papers.service';

describe('HaiPapersController', () => {
  let controller: HaiPapersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HaiPapersController],
      providers: [HaiPapersService],
    }).compile();

    controller = module.get<HaiPapersController>(HaiPapersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
