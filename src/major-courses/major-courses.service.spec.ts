import { Test, TestingModule } from '@nestjs/testing';
import { MajorCoursesService } from './major-courses.service';

describe('MajorCoursesService', () => {
  let service: MajorCoursesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MajorCoursesService],
    }).compile();

    service = module.get<MajorCoursesService>(MajorCoursesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
