import { Test, TestingModule } from '@nestjs/testing';
import { AiServicesService } from './ai-services.service';

describe('AiServicesService', () => {
  let service: AiServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiServicesService],
    }).compile();

    service = module.get<AiServicesService>(AiServicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
