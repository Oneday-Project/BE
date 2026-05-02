import { Test, TestingModule } from '@nestjs/testing';
import { ResearchFieldsController } from './research-fields.controller';
import { ResearchFieldsService } from './research-fields.service';

describe('ResearchFieldsController', () => {
  let controller: ResearchFieldsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResearchFieldsController],
      providers: [ResearchFieldsService],
    }).compile();

    controller = module.get<ResearchFieldsController>(ResearchFieldsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
