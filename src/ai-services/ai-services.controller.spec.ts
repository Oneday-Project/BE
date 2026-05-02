import { Test, TestingModule } from '@nestjs/testing';
import { AiServicesController } from './ai-services.controller';
import { AiServicesService } from './ai-services.service';

describe('AiServicesController', () => {
  let controller: AiServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiServicesController],
      providers: [AiServicesService],
    }).compile();

    controller = module.get<AiServicesController>(AiServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
