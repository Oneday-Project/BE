import { Test, TestingModule } from '@nestjs/testing';
import { MajorCoursesController } from './major-courses.controller';
import { MajorCoursesService } from './major-courses.service';

describe('MajorCoursesController', () => {
  let controller: MajorCoursesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MajorCoursesController],
      providers: [MajorCoursesService],
    }).compile();

    controller = module.get<MajorCoursesController>(MajorCoursesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
