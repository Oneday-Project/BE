import { Test, TestingModule } from '@nestjs/testing';
import { ResearchFieldsService } from './research-fields.service';

describe('ResearchFieldsService', () => {
  let service: ResearchFieldsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResearchFieldsService],
    }).compile();

    service = module.get<ResearchFieldsService>(ResearchFieldsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
