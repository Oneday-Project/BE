import { BadRequestException, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { BasicPapersService } from './basic-papers.service';
import { ApiBearerAuth, ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';

@Controller('papers/basic-papers')
@ApiExcludeController()
@ApiBearerAuth()
export class BasicPapersController {
  constructor(private readonly basicPapersService: BasicPapersService) {}

  @Get('fetch-arxiv')
  @ApiOperation({
    description: 'arXiv API로 arXiv 논문을 가져오는 API(arxiv DB에 저장)', 
  })
  @Roles(RolesEnum.ADMIN)
  async fetchArxiv(
    // 이 쿼리들은 나중에 DTO로 바꿔야함
    @Query('category') category: string = 'cs.AI',
    @Query('start', ParseIntPipe) start: number = 0,
    @Query('sort') sort?: string,
    @Query('startDate') startDate?: string, // YYYYMMDD 형식 (예: 20240101)
    @Query('endDate') endDate?: string,     // YYYYMMDD 형식 (예: 20240131)
  ) {
    return this.basicPapersService.fetchArxiv(category, start, sort, startDate, endDate);
  }

  @Get('fetch-ss')
  @ApiOperation({
    description: 'SS(Semantic Scholar) API로 fetch-arxiv에서 가져온 논문을 기준으로 SS에 arXivID가 있는 논문을 가져오는 API(ss DB에 저장)', 
  })
  @Roles(RolesEnum.ADMIN)
  async fetchSs() {
    return this.basicPapersService.fetchSs();
  }

  @Get('fetch-by-ranking')
  @ApiOperation({
    description: 'SS(Semantic Scholar) API로 인용수가 높은 순서대로 논문을 가져오는 API(ss, arxiv DB 동시에 저장)', 
  })
  @Roles(RolesEnum.ADMIN)
  async fetchByRanking(
    @Query('token') token?: string,
    @Query('query') query?: string,
    @Query('sort') sort?: string,       // 'influence' 넣으면 영향력 점수 기준, 생략 시 인용 수 기준
    @Query('field') field?: string,     // SS 분야 선택 (생략 시 기본값 Computer Science)
    @Query('category') category?: string, // AI 세부분야 선택 (예: cs.CV, cs.LG / 생략 시 AI 전체)
  ) {
    return this.basicPapersService.fetchByRanking(token, query, sort, field, category);
  }

  @Get('fetch-papers')
  @ApiOperation({
    description: '여러 논문의 arXivID를 공백을 기준으로 여러개 받아서 논문을 저장하는 API(ss, arxiv DB 동시에 저장)', 
  })
  @Roles(RolesEnum.ADMIN)
  async fetchPapers(@Query('arxivIds') arxivIds?: string) {
    if (!arxivIds) throw new BadRequestException('arxivIds 파라미터는 필수입니다. (예: 1706.03762 2301.00001)');
    return this.basicPapersService.fetchPapers(arxivIds);
  }


  @Get('fetch-top-cited')
  @ApiOperation({
    description:
      '기간·분야를 지정해 arXiv에서 해당 논문을 모두 훑은 뒤, ' +
      'Semantic Scholar 인용수 기준 상위 N편만 저장하는 API (ss, arxiv DB 동시에 저장)',
  })
  @Roles(RolesEnum.ADMIN)
  async fetchTopCited(
    @Query('category') category: string = 'cs.CV',       // arXiv 분야 코드
    @Query('startDate') startDate?: string,              // YYYYMMDD (예: 20260601)
    @Query('endDate') endDate?: string,                  // YYYYMMDD (예: 20260630)
    @Query('count', new ParseIntPipe({ optional: true })) count: number = 10,      // 저장할 상위 편수
    // 훑을 최대 편수(안전장치). cs.CV 한 달이 3,300편 수준이라 한 달 조회는 기본값으로 커버된다.
    // 이 값을 넘으면 일부만 훑으므로 응답의 truncated가 true가 된다.
    @Query('maxScan', new ParseIntPipe({ optional: true })) maxScan: number = 5000,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'startDate와 endDate는 필수입니다. (YYYYMMDD 형식, 예: startDate=20260601&endDate=20260630)',
      );
    }
    return this.basicPapersService.fetchTopCited(category, startDate, endDate, count, maxScan);
  }


  @Get('fetch-monthly-picks')
  @ApiOperation({
    description:
      '이달의 논문 — 지정한 연월에서 분야당 인용수 상위 N편을 뽑아 저장하는 API. ' +
      'arXiv를 분야별로 나눠 돌지 않고 OR 검색으로 한 번에 훑어 절반 가까이 빠르다 (ss, arxiv DB 동시에 저장)',
  })
  @Roles(RolesEnum.ADMIN)
  async fetchMonthlyPicks(
    @Query('year', ParseIntPipe) year: number,      // 예: 2026
    @Query('month', ParseIntPipe) month: number,    // 1~12
    @Query('perCategory', new ParseIntPipe({ optional: true })) perCategory: number = 1,
    // 미지정 시 research_field 테이블의 분야 전체가 대상 (예: 'cs.CV,cs.LG')
    @Query('categories') categories?: string,
    // 한 달 합집합이 12,000건 수준이라 기본값으로 충분하다. 넘으면 truncated=true
    @Query('maxScan', new ParseIntPipe({ optional: true })) maxScan: number = 20000,
  ) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('month는 1~12 사이여야 합니다.');
    }

    const categoryList = categories
      ?.split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    return this.basicPapersService.fetchMonthlyPicks(
      year, month, perCategory, categoryList, maxScan,
    );
  }


  @Post('integrate')
  @ApiOperation({
    description: 'SS DB와 arxiv DB에 있는 논문을 Paper DB에 통합하는 API', 
  })
  @Roles(RolesEnum.ADMIN)
  async integrate() {
    return this.basicPapersService.integrate();
  }


  @Post('update-stats')
  @ApiOperation({
    description: 'paper DB의 모든 논문에 대해 인용수, 영향력 점수를 업데이트하는 API', 
  })
  @Roles(RolesEnum.ADMIN)
  async updateStats() {
    return this.basicPapersService.updateStats();
  }
}
