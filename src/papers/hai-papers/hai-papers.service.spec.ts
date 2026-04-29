import { Test, TestingModule } from '@nestjs/testing';
import { HaiPapersService } from './hai-papers.service';

describe('HaiPapersService', () => {
  let service: HaiPapersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HaiPapersService],
    }).compile();

    service = module.get<HaiPapersService>(HaiPapersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
