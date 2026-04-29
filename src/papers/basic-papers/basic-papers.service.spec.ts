import { Test, TestingModule } from '@nestjs/testing';
import { BasicPapersService } from './basic-papers.service';

describe('BasicPapersService', () => {
  let service: BasicPapersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BasicPapersService],
    }).compile();

    service = module.get<BasicPapersService>(BasicPapersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
