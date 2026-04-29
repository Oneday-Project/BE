import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RawArxiv } from '../entities/raw-arxiv.entity';
import { RawSemanticScholar } from '../entities/raw-semantic-scholar.entity';
import { Papers } from '../entities/papers.entity';
import { DataSource, DeepPartial, In, Repository } from 'typeorm';
import { parseStringPromise } from 'xml2js'; // arXiv API 응답(XML)을 JavaScript 객체로 파싱하는 라이브러리
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';


// ══════════════════════════════════════════════════════════════════
// ★ Semantic Scholar API 키 설정
// ══════════════════════════════════════════════════════════════════

const SS2_BATCH_URL  = 'https://api.semanticscholar.org/graph/v1/paper/batch'; // 여러 논문을 한 번에 조회하는 배치 엔드포인트
const SS2_BULK_URL   = 'https://api.semanticscholar.org/graph/v1/paper/search/bulk'; // 키워드 기반 대량 검색 엔드포인트
const SS2_PAPER_URL  = 'https://api.semanticscholar.org/graph/v1/paper'; // 단건 논문 조회 엔드포인트
const SS2_BULK_QUERY = 'artificial intelligence machine learning deep learning'; // bulk 검색 시 사용하는 기본 키워드
const ARXIV_API_BASE = 'https://export.arxiv.org/api/query'; // arXiv API 기본 URL

const ARXIV_MAX_RESULTS    = 2000; // arXiv API 한 번 요청에 가져올 최대 논문 수
const ARXIV_ID_BATCH_SIZE  = 200;  // arXiv id_list 요청 시 한 배치당 처리할 ID 수
const SS2_BATCH_SIZE       = 500;  // Semantic Scholar 배치 요청 시 한 번에 보낼 최대 ID 수
const REQUEST_DELAY_MS     = 1100; // API 요청 사이 대기 시간(ms) — Rate Limit 초과 방지

const SS2_FIELDS = [ // Semantic Scholar API에서 가져올 필드 목록 (수집용)
  'paperId',               // SS 고유 ID
  'externalIds',           // DOI, arXiv ID 등 외부 식별자
  'publicationDate',       // 출판일
  'year',                  // 출판 연도
  'citationCount',         // 인용 수
  'influentialCitationCount', // 영향력 있는 인용 수
  'publicationVenue',      // 게재 학술대회/저널 정보
  'journal',               // 저널 정보
].join(','); // 배열을 쉼표로 연결해 쿼리 파라미터로 사용

const SS2_UPDATE_FIELDS = [ // 갱신 시 필요한 필드만 요청 (페이로드 최소화)
  'paperId',               // 어떤 논문인지 식별
  'externalIds',           // arXiv ID 매핑용
  'citationCount',         // 갱신할 인용 수
  'influentialCitationCount', // 갱신할 영향력 점수
].join(',');

// AI 관련 arXiv 분야 필터
const AI_ARXIV_CATEGORIES = new Set([ // AI 관련 분야만 필터링하기 위한 카테고리 집합 (Set은 빠른 존재 여부 확인용)
  'cs.AI', // Artificial Intelligence
  'cs.LG', // Machine Learning
  'cs.CV', // Computer Vision
  'cs.CL', // Computational Linguistics / NLP
  'cs.RO', // Robotics
  'cs.IR', // Information Retrieval
  'cs.SD', // Sound (Speech, Audio)
  'cs.HC', // Human-Computer Interaction
  'cs.MM', // Multimedia
  'cs.NE', // Neural and Evolutionary Computing
  'cs.CR', // Cryptography and Security
  'cs.DC', // Distributed Computing
  'stat.ML', // Statistics - Machine Learning
]);

interface ArxivParsed { // arXiv API 응답에서 파싱한 논문 데이터의 타입 정의
  arxivId: string;    // arXiv 고유 ID (예: 2301.00001)
  title: string;      // 논문 제목
  authors: string[];  // 저자 목록
  abstract: string;   // 초록
  categories: string[]; // 분야 카테고리 목록
  pdfUrl: string;     // PDF 다운로드 URL
}


@Injectable()
export class BasicPapersService {
  constructor(
    @InjectRepository(RawArxiv) 
    private readonly arxivRepository: Repository<RawArxiv>, 
    @InjectRepository(RawSemanticScholar) 
    private readonly ss2Repository: Repository<RawSemanticScholar>,
    @InjectRepository(Papers) 
    private readonly papersRepository: Repository<Papers>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource, 
  ) {}

  

  // ══════════════════════════════════════════════════════════════════
  // 1. arXiv 분야 기반 수집
  // ══════════════════════════════════════════════════════════════════

  async fetchArxiv(
    category: string, // 수집할 arXiv 카테고리 (예: cs.AI)
    start: number,    // 페이지네이션 시작 인덱스
    sort?: string,    // 정렬 옵션 ('latest' 전달 시 최신순 정렬. 넣지 않으면 관련도순)
  ) {
    let url = `${ARXIV_API_BASE}?search_query=cat:${category}&start=${start}&max_results=${ARXIV_MAX_RESULTS}`; 

    if (sort === 'latest') { // 최신순 정렬 옵션이 있을 때만 파라미터 추가
      url += `&sortBy=submittedDate&sortOrder=descending`; // 제출일 기준 내림차순 정렬
    }

    const response = await fetch(url); // arXiv API에 HTTP GET 요청. API 요청 시 fetch()를 사용(fetch()는 JavaScript의 내장 HTTP 요청 함수)
    if (!response.ok) { // HTTP 상태코드가 200번대(성공)가 아니면 에러
      throw new Error(`arXiv API 오류: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text(); // 응답 본문을 XML 문자열로 읽기
    const parsed = await parseStringPromise(xmlText, { explicitArray: true }); // XML → JS 객체 변환 (모든 값을 배열로 파싱). ex. explicitArray: true → { title: ["논문 제목"] } -> 이렇게 모든 값을 무조건 배열로 감쌈
    const entries: any[] = parsed?.feed?.entry ?? []; // 파싱된 논문 항목 배열 추출 (없으면 빈 리스트)
    // parsed 형태 예시
    // {
    //   feed: {
    //     entry: [
    //       { title: ["논문 제목1"], ... }, // entry 배열의 요소 하나가 논문 하나
    //       { title: ["논문 제목2"], ... },
    //     ] -> 이 리스트가 entries
    //   }
    // }

  // arXiv api로 가져온 논문 하나 예시
  //   {
  //     id: ["http://arxiv.org/abs/2301.00001v2"],
  //     title: ["Attention Is All You Need"],
  //     author: [
  //       { name: ["Ashish Vaswani"] },
  //       { name: ["Noam Shazeer"] },
  //       { name: ["Niki Parmar"] }
  //     ],
  //     summary: ["We propose a new simple network architecture, the Transformer, based solely on attention mechanisms..."],
  //     category: [
  //       { $: { term: "cs.CL" } },
  //       { $: { term: "cs.AI" } }
  //     ],
  //     link: [
  //       { $: { rel: "alternate", href: "http://arxiv.org/abs/2301.00001v2" } },
  //       { $: { rel: "related", type: "application/pdf", href: "http://arxiv.org/pdf/2301.00001v2" } }
  //     ],
  //     published: ["2023-01-01T00:00:00Z"],
  //     updated: ["2023-01-05T00:00:00Z"]
  // }

    const papersMap = new Map<string, ArxivParsed>(); // arxivId를 키로 중복 제거하기 위한 Map
    // key(arxivId) - string 타입, value - ArxivParsed 타입

    let skippedNoPdf = 0; // PDF 링크 없어서 건너뛴 논문 수 카운터

    for (const entry of entries) { // 각 논문 항목 순회
      const idUrl: string = entry.id?.[0] ?? ''; // arXiv URL 형태의 ID (예: http://arxiv.org/abs/2301.00001v1)
      const arxivId = idUrl.split('/').pop()?.replace(/v\d+$/, ''); // URL에서 ID만 추출하고 버전 번호(v1, v2 등) 제거
      // .split('/') -> ["http:", "", "arxiv.org", "abs", "2301.00001v2"]
      // .pop() -> "2301.00001v2"
      // .replace(/v\d+$/, '') -> "2301.00001"   
      // 정규식 문법: v = 문자 v, \d+ = 숫자 1개 이상, $ = 문자열 끝  = "v+숫자들"을 의미(ex. v1, v23)

      if (!arxivId) continue; // ID 추출 실패 시 이 항목 건너뜀

      const links: any[] = entry.link ?? []; // 논문의 링크 목록
      const pdfLink = links.find((l) => l.$?.type === 'application/pdf'); // PDF 타입 링크만 찾기
      if (!pdfLink) { skippedNoPdf++; continue; } // PDF 링크 없으면 카운터 증가 후 건너뜀

      const title    = (entry.title?.[0] ?? '').replace(/\s+/g, ' ').trim(); // 제목의 연속된 공백을 하나의 공백으로 정리(ex. Attention Is    All You Need  -> Attention Is All You Need)
      const authors  = (entry.author ?? []).map((a: any) => a.name?.[0] as string).filter(Boolean); // 저자 이름 배열 추출, .filter(Boolean) -> 빈값(undefined, null, '') 제거
      const abstract = (entry.summary?.[0] ?? '').replace(/\s+/g, ' ').trim(); // 초록의 연속된 공백 정리
      const categories = (entry.category ?? []).map((c: any) => c.$.term as string); // 카테고리 코드 배열 추출

      if (!papersMap.has(arxivId)) { // 같은 arXiv ID가 아직 Map에 없을 때만 추가 (중복 방지)
        papersMap.set(arxivId, { arxivId, title, authors, abstract, categories, pdfUrl: pdfLink.$.href });
      }
    }

    const papers = [...papersMap.values()]; // Map에서 중복 제거된 논문 배열로 변환
    const fetchedIds = papers.map((p) => p.arxivId); // API에서 가져온 arXiv ID 목록
    const existingIds = new Set<string>(); // DB에 이미 있는 ID를 담을 Set (빠른 조회용)

    if (fetchedIds.length > 0) { // 가져온 논문이 있을 때만 DB 조회
      const existing = await this.arxivRepository.findBy({ arxivId: In(fetchedIds) }); // DB에서 이미 존재하는 arXiv ID 조회
      existing.forEach((r) => existingIds.add(r.arxivId)); // 존재하는 ID를 Set에 추가
    }

    const newPapers = papers
      .filter((p) => !existingIds.has(p.arxivId)) // DB에 없는 논문만 필터링
      .map((p) =>
        this.arxivRepository.create({ // 엔티티 인스턴스 생성 (DB 저장 전 단계)
          arxivId:  p.arxivId,
          title:    p.title,
          authors:  p.authors,
          abstract: p.abstract,
          category: p.categories,
          pdfUrl:   p.pdfUrl,
        }),
      );

    if (newPapers.length > 0) await this.arxivRepository.save(newPapers); // 새 논문이 있을 때만 DB에 저장

    const saved = newPapers.length; // 실제 저장된 논문 수
    const skippedDuplicate = papers.length - saved; // 중복으로 건너뛴 논문 수

    return { saved, skippedDuplicate, skippedNoPdf, fetchedFromApi: entries.length }; // 수집 결과 반환
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. raw_arxiv 기반 SS 데이터 보완
  // ══════════════════════════════════════════════════════════════════

  async fetchSs() {
    const allArxiv = await this.arxivRepository.find({ select: ['arxivId'] }); // raw_arxiv에서 arxivId만 선택해 전체 조회 (메모리 절약)
    const allArxivIds = allArxiv.map((r) => r.arxivId); // arxivId 문자열 리스트로 변환

    const existing = await this.ss2Repository.find({ select: ['arxivId'] }); // raw_semantic_scholar에서 이미 저장된 arxivId 조회
    const existingArxivIds = new Set(existing.map((r) => r.arxivId)); // 빠른 중복 검사를 위해 Set으로 변환

    const alreadyExists = allArxivIds.filter((id) => existingArxivIds.has(id)).length; // 이미 SS 데이터가 있는 논문 수

    const toFetch = allArxivIds.filter((id) => !existingArxivIds.has(id)); // SS 데이터가 없는 논문만 추출 (수집 대상)

    let totalSaved = 0; // 이번 실행에서 저장된 총 논문 수
    let totalNotFound = 0; // SS에서 찾지 못한 논문 수

    for (let i = 0; i < toFetch.length; i += SS2_BATCH_SIZE) { // SS2_BATCH_SIZE 단위로 배치 처리
      const batch = toFetch.slice(i, i + SS2_BATCH_SIZE); // 현재 배치의 arXiv ID 목록(SS2_BATCH_SIZE 개수 만큼 가져옴)

      //  Semantic Scholar API 키
      const SS2_API_KEY = this.configService.get<string>(envVariableKeys.semanticScholarApi) as string

      // SS 배치 API 호출 방식(그냥 규칙(문법)임. 공식 batch endpoint 사용 방식)
      const response = await fetch(`${SS2_BATCH_URL}?fields=${SS2_FIELDS}`, { 
        method: 'POST', // 배치 조회는 POST 방식
        headers: { 'Content-Type': 'application/json', 'x-api-key': SS2_API_KEY }, // "내가 보내는 형식이 JSON 형식 + API 키 헤더" 를 ss api에 알려줌
        body: JSON.stringify({ ids: batch.map((id) => `ArXiv:${id}`) }), // arXiv ID 앞에 'ArXiv:'를 붙여 SS 형식으로 변환
      });

      if (!response.ok) { 
        if (i + SS2_BATCH_SIZE < toFetch.length){
          await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 일정 시간 대기 후
        } 
        continue; // 이 배치는 건너뛰고 다음 배치 진행
      }

      const data: (any | null)[] = await response.json(); // API 응답(JSON)을 읽어서 배열 형태 데이터로 저장 (SS에서 찾지 못한 논문은 null로 반환)
      const notFoundCount = data.filter((p) => p === null).length; // null인 항목 수 = SS에서 찾지 못한 논문 수
      totalNotFound += notFoundCount; // 누적 합산

      // ss에서 가져온 data 예시
      // [
      //   {
      //     paperId: "649def34f8be52c8b66281af98ae884c09aef38b",
      //     externalIds: {
      //       ArXiv: "2301.00001",
      //       DOI: "10.1000/example1"
      //     },
      //     publicationDate: "2023-01-02",
      //     year: 2023,
      //     citationCount: 152,
      //     influentialCitationCount: 34,
      //     journal: {
      //       name: "Journal of AI Research"
      //     }
      //   },

      //   {
      //     paperId: "9ab2cd88ee72c8811234567890abcdef12345678",
      //     externalIds: {
      //       ArXiv: "2301.00002"
      //     },
      //     publicationDate: "2023-01-10",
      //     year: 2023,
      //     citationCount: 18,
      //     influentialCitationCount: 3,
      //     publicationVenue: {
      //       name: "NeurIPS"
      //     }
      //   },
      // ]

      const papers = data
        .map((paper, idx) => { // 각 응답 항목을 엔티티로 매핑.  paper - 현재 요소, idx - 현재 요소의 인덱스
          if (paper === null) return null; // SS에서 찾지 못한 논문은 null 유지
          const arxivId = (paper.externalIds?.ArXiv as string | undefined) ?? batch[idx]; // SS 응답에서 arXiv ID 추출, 없으면 배치의 원래 ID 사용
          return this.mapToPaper(paper, arxivId); // SS 응답 데이터를 RawSemanticScholar 엔티티로 변환
        })
        .filter((p): p is RawSemanticScholar => p !== null); // null 제거 (타입 가드로 타입도 좁힘). 남은 값들은 RawSemanticScholar 타입

      if (papers.length > 0) { // 저장할 데이터가 있을 때만
        await this.ss2Repository.upsert(papers, ['ss2Id']); // ss2Id 기준으로 upsert(insert + update) (있으면 업데이트, 없으면 삽입)
        totalSaved += papers.length; // 저장된 수 누적
      }

      if (i + SS2_BATCH_SIZE < toFetch.length) await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 다음 요청 전 딜레이
    }

    return { total: allArxivIds.length, alreadyExists, saved: totalSaved, notFound: totalNotFound }; // 전체 처리 결과 반환
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. 인용 수 / 영향력 점수 기준 수집
  // ══════════════════════════════════════════════════════════════════

  async fetchByRanking(token?: string, query?: string, sort?: string, field?: string, category?: string) {
    const resolvedQuery = query ?? SS2_BULK_QUERY; // 쿼리가 없으면 기본 AI 키워드 사용
    const resolvedField = field ?? 'Computer Science'; // 분야가 없으면 기본값 Computer Science 사용

    // SS API는 citationCount만 정렬 지원 → sort에서 influence 선택 시 citationCount 기준으로 가져온 후 재정렬로 처리
    // encodeURIComponent() - URL에 넣을 문자열을 안전하게 인코딩(변환)하는 JavaScript 내장 함수(공백, 특수문자, 한글 등을 URL에서 문제없도록 변환)
    let url =
      `${SS2_BULK_URL}?query=${encodeURIComponent(resolvedQuery)}` +          // 검색 키워드 URL 인코딩
      `&fields=${SS2_FIELDS}` +                                                // 가져올 필드 지정
      `&fieldsOfStudy=${encodeURIComponent(resolvedField)}` +                  // 선택된 분야로 필터
      `&sort=citationCount:desc&limit=1000`;                                   // SS API는 citationCount만 정렬 지원
    if (token) url += `&token=${encodeURIComponent(token)}`; // 페이지네이션 토큰이 있으면 추가 (다음 페이지 요청)

    //  Semantic Scholar API 키
    const SS2_API_KEY = this.configService.get<string>(envVariableKeys.semanticScholarApi) as string

    const ssResponse = await fetch(url, { headers: { 'x-api-key': SS2_API_KEY } }); // SS Bulk API 호출

    if (!ssResponse.ok) { // 요청 실패 시
      const errorBody = await ssResponse.text(); 
      throw new Error(`SS2 Bulk API 오류: ${ssResponse.status} ${ssResponse.statusText} — ${errorBody}`);
    }

    const ssJson = await ssResponse.json(); // 응답 JSON 파싱
    // ssJson 예시
    // {
    //   data: [...논문배열...],
    //   token: "다음페이지토큰"
    // }

    const allPapers: any[] = ssJson.data ?? []; // 논문 배열 추출 (없으면 빈 배열)
    const nextToken: string | null = ssJson.token ?? null; // 다음 페이지 토큰 (마지막 페이지면 null)

    const withArxiv = allPapers.filter((p) => p.externalIds?.ArXiv); // arXiv ID가 있는 논문만 필터링 (arXiv 없는 논문은 처리 불가)

    if (withArxiv.length === 0) { // arXiv ID 있는 논문이 없으면 빈 결과 반환
      return { ssSaved: 0, ssAlreadyExists: 0, arxivSaved: 0, arxivAlreadyExists: 0, categoryFiltered: 0, nextToken };
    }

    // arXiv API로 분야 정보 획득
    const arxivIds = withArxiv.map((p) => p.externalIds.ArXiv as string); // arXiv ID 목록 추출
    const arxivEntries = await this.fetchArxivEntries(arxivIds); // arXiv API로 분야 정보 포함한 상세 데이터 수집

    // AI 분야 필터링 (category 파라미터가 있으면 해당 세부분야만, 없으면 AI 전체 카테고리)
    const aiArxivEntries = arxivEntries.filter((e) => 
      category ? e.categories.includes(category) : e.categories.some((cat) => AI_ARXIV_CATEGORIES.has(cat)), 
      // 사용자가 특정 카테고리를 지정했으면 그 카테고리에 해당하는 논문만 필터링
      // 지정하지 않았다면 AI 관련 카테고리 중 하나라도 포함된 논문만 통과(.some()사용)
    );
    const aiArxivIdSet = new Set(aiArxivEntries.map((e) => e.arxivId)); // arXiv 논문 ID Set (빠른 조회용)
    const categoryFiltered = withArxiv.length - aiArxivIdSet.size; // 분야 불일치로 제외된 논문 수(ss2에서 찾은 논문 수 - arXiv 논문 수)

    // SS2 검색 결과(withArxiv) 중에서, arXiv ID가 있고, 그 arXiv 논문이 AI 관련 카테고리로 확인된 논문(aiArxivIdSet)만 필터링
    const aiSsPapers = withArxiv.filter((p) => aiArxivIdSet.has(p.externalIds.ArXiv as string));

    // sort=influence면 영향력 점수 1차, 인용 수 2차(영향력 점수 같으면 인용 수로 순위 갈림) / 기본값은 인용 수 1차, 영향력 점수 2차 순으로 정렬
    aiSsPapers.sort((a, b) => {
      const primary = sort === 'influence'
        ? (b.influentialCitationCount ?? 0) - (a.influentialCitationCount ?? 0) // 영향력 점수 1차
        : (b.citationCount ?? 0) - (a.citationCount ?? 0);                      // 인용 수 1차
      if (primary !== 0) return primary;
      return sort === 'influence'
        ? (b.citationCount ?? 0) - (a.citationCount ?? 0)                       // 인용 수 2차
        : (b.influentialCitationCount ?? 0) - (a.influentialCitationCount ?? 0); // 영향력 점수 2차
    });

    // SS 중복 체크(기존 ss2 DB에 있는 논문은 거름)
    const incomingIds = aiSsPapers.map((p) => p.paperId as string); // 저장하려는 SS 논문 ID 목록
    const existingSsIds = new Set(
      incomingIds.length > 0
        ? (await this.ss2Repository.find({ select: ['ss2Id'], where: { ss2Id: In(incomingIds) } })).map((r) => r.ss2Id) // DB에 이미 있는 SS ID 조회
        : [],
    );

    const newSsPapers = aiSsPapers.filter((p) => !existingSsIds.has(p.paperId)); // DB에 없는 논문만 추출
    const ssAlreadyExists = aiSsPapers.length - newSsPapers.length; // 이미 존재해서 건너뛴 수

    let ssSaved = 0;
    if (newSsPapers.length > 0) { // 저장할 새 논문이 있을 때만
      await this.ss2Repository.save(newSsPapers.map((p) => this.mapToPaper(p, p.externalIds.ArXiv as string))); // SS 데이터 DB 저장
      ssSaved = newSsPapers.length; // 저장된 수 기록
    }

    // 새 SS 논문의 arXiv 데이터 저장(= arXiv DB에도 위의 조건을 모두 만족하는 논문 저장)
    const newArxivIdSet = new Set(newSsPapers.map((p) => p.externalIds.ArXiv as string)); // 새로 저장한 SS 논문의 arXiv ID Set
    const newArxivEntries = aiArxivEntries.filter((e) => newArxivIdSet.has(e.arxivId)); // 새 SS 논문에 해당하는 arXiv 데이터만 추출
    const { saved: arxivSaved, alreadyExists: arxivAlreadyExists } = await this.saveArxivEntries(newArxivEntries); // arXiv 데이터 저장 (내부에서 중복 체크)

    return { ssSaved, ssAlreadyExists, arxivSaved, arxivAlreadyExists, categoryFiltered, nextToken }; // 전체 처리 결과 반환
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. 특정 논문 단건 수집 (arxivId)
  // ══════════════════════════════════════════════════════════════════

  async fetchOne(arxiv: string) {
    const cleanId = arxiv.trim().replace(/v\d+$/, ''); // 입력값 앞뒤 공백 제거 및 버전 번호(v1, v2 등) 제거

    // ── 0. DB 사전 확인 — 이미 존재하면 즉시 반환 ───────────────────────
    const existingArxivCheck = await this.arxivRepository.findOne({ where: { arxivId: cleanId } }); // raw_arxiv에 이미 있는지 확인
    const existingSsCheck = await this.ss2Repository.findOne({ where: { arxivId: cleanId } }); // raw_semantic_scholar에 이미 있는지 확인
    if (existingArxivCheck && existingSsCheck) { // 둘 다 있으면 API 호출 없이 DB 데이터 반환
      return {
        arxivId: cleanId,
        title: existingArxivCheck.title,
        categories: existingArxivCheck.category,
        arxivStatus: 'already_exists', // 이미 존재함을 나타내는 상태값
        ssStatus: 'already_exists',
        citationCount: existingSsCheck.citationCount,
        influentialCitationCount: existingSsCheck.influenceScore,
      };
    }

    // arXiv API 호출
    const arxivUrl = `${ARXIV_API_BASE}?id_list=${cleanId}&max_results=1`; // 특정 ID 단건 조회 URL

    const arxivResponse = await fetch(arxivUrl); // arXiv API 요청
    if (!arxivResponse.ok) { // 요청 실패 시 에러
      throw new Error(`arXiv API 오류: ${arxivResponse.status} ${arxivResponse.statusText}`);
    }

    const xmlText = await arxivResponse.text(); // XML 응답 텍스트 읽기
    const parsed = await parseStringPromise(xmlText, { explicitArray: true }); // XML → JS 객체 변환
    const entries: any[] = parsed?.feed?.entry ?? []; // 논문 항목 추출

    if (entries.length === 0) { // 결과가 없으면 논문을 찾지 못한 것
      throw new NotFoundException(`논문을 찾을 수 없습니다: "${arxiv}"`);
    }

    const entry = entries[0]; // 단건 조회이므로 첫 번째 항목만 사용
    const idUrl: string = entry.id?.[0] ?? ''; // arXiv URL 형태의 ID
    const arxivId  = idUrl.split('/').pop()?.replace(/v\d+$/, '') ?? ''; // URL에서 버전 없는 순수 ID 추출
    const title    = (entry.title?.[0] ?? '').replace(/\s+/g, ' ').trim(); // 제목 정리
    const authors  = (entry.author ?? []).map((a: any) => a.name?.[0] as string).filter(Boolean); // 저자 목록
    const abstract = (entry.summary?.[0] ?? '').replace(/\s+/g, ' ').trim(); // 초록 정리
    const categories: string[] = (entry.category ?? []).map((c: any) => c.$.term as string); // 카테고리 목록
    const links: any[] = entry.link ?? []; // 링크 목록
    const pdfLink = links.find((l) => l.$?.type === 'application/pdf'); // PDF 링크 찾기
    const pdfUrl: string | null = pdfLink?.$?.href ?? null; // PDF URL 추출 (없으면 null)

    // SS API 단건 조회 (저장 전 먼저 확인)
    const ssUrl = `${SS2_PAPER_URL}/ArXiv:${arxivId}?fields=${SS2_FIELDS}`; // arXiv ID로 SS 단건 조회 URL 구성

    //  Semantic Scholar API 키
    const SS2_API_KEY = this.configService.get<string>(envVariableKeys.semanticScholarApi) as string

    const ssResponse = await fetch(ssUrl, { headers: { 'x-api-key': SS2_API_KEY } }); // SS API 요청

    if (ssResponse.status === 404) { // SS에 해당 논문이 없는 경우
      throw new NotFoundException(`Semantic Scholar에서 논문을 찾을 수 없습니다: "${arxivId}"`);
    }
    if (!ssResponse.ok) { // 기타 에러
      throw new Error(`SS2 API 오류: ${ssResponse.status} ${ssResponse.statusText}`);
    }

    const ssData = await ssResponse.json(); // SS 응답 파싱
    const citationCount: number | null = ssData.citationCount ?? null; // 인용 수 (없으면 null)
    const influentialCitationCount: number | null = ssData.influentialCitationCount ?? null; // 영향력 있는 인용 수 (없으면 null)

    // raw_arxiv 저장
    let arxivStatus: 'saved' | 'already_exists'; // 저장 결과 상태를 담을 변수

    if (existingArxivCheck) { // 이미 raw_arxiv에 있으면
      arxivStatus = 'already_exists'; // 상태만 표시하고 저장하지 않음
    } else { // 없으면 새로 저장
      await this.arxivRepository.save(
        this.arxivRepository.create({ arxivId, title, authors, abstract, category: categories, pdfUrl: pdfUrl ?? '' }), // pdfUrl이 null이면 빈 문자열 저장
      );
      arxivStatus = 'saved';
    }

    // raw_semantic_scholar 저장
    let ssStatus: 'saved' | 'already_exists'; // SS 저장 결과 상태
    const existingSs = await this.ss2Repository.findOne({ where: { ss2Id: ssData.paperId } }); // ss2Id로 중복 확인 (arxivId와 별개로 SS 고유 ID로도 체크)

    if (existingSs) { // 이미 SS 데이터가 있으면
      ssStatus = 'already_exists';
    } else { // 없으면 새로 저장
      await this.ss2Repository.save(this.mapToPaper(ssData, arxivId)); // SS 응답을 엔티티로 변환 후 저장
      ssStatus = 'saved';
    }

    return { arxivId, title, categories, arxivStatus, ssStatus, citationCount, influentialCitationCount }; // 수집 결과 반환
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. raw_arxiv + raw_semantic_scholar → papers 통합
  // ══════════════════════════════════════════════════════════════════

  async integrate() {
    // ── 1. raw_arxiv 전체 조회 ────────────────────────────────────────────
    const arxivList = await this.arxivRepository.find(); // raw_arxiv 테이블 전체 데이터 조회

    // ── 2. raw_semantic_scholar 전체 조회 → arxivId 기준 Map 생성 ─────────
    const ss2List = await this.ss2Repository.find(); // raw_semantic_scholar 테이블 전체 데이터 조회
    const ss2Map = new Map(ss2List.map((s) => [s.arxivId, s])); // arxivId를 키로 Map 생성 (arXiv 데이터와 빠르게 매핑하기 위함)
    // ss2Map 예시
    // Map {
    //   "2301.00001" => { 논문 정보 },
    //   "2301.00002" => { 논문 정보 },
    //   ...
    // }

    // ── 3. INNER JOIN — 양쪽 모두 있는 논문만 추출 ───────────────────────
    const joined = arxivList.filter((a) => ss2Map.has(a.arxivId)); // raw_arxiv 중 SS 데이터도 있는 논문만 필터링 (inner join 효과)

    // ── 4. papers에 이미 있는 arxivId 조회 → 중복 제외 ───────────────────
    const joinedIds = joined.map((a) => a.arxivId); // inner join 결과의 arxivId 목록
    const existingIds = new Set<string>(); // 이미 papers 테이블에 있는 ID를 담을 Set

    if (joinedIds.length > 0) { // 대상 논문이 있을 때만 DB 조회
      const existing = await this.papersRepository.findBy({ arxivId: In(joinedIds) }); // papers 테이블에 이미 있는 논문 조회
      existing.forEach((p) => existingIds.add(p.arxivId)); // Set에 추가
    }

    const alreadyExists = existingIds.size; // 이미 papers에 있는 논문 수
    const toInsert = joined.filter((a) => !existingIds.has(a.arxivId)); // 아직 papers에 없는 논문만 추출

    // ── 5. papers 저장 ────────────────────────────────────────────────────
    if (toInsert.length > 0) { // 삽입할 데이터가 있을 때만
      const newPapers = toInsert.map((a) => {
        const ss = ss2Map.get(a.arxivId)!; // arXiv 데이터에 대응하는 SS 데이터 가져오기 (위에서 inner join 했으므로 반드시 존재)
        return this.papersRepository.create({ // arXiv + SS 데이터를 합쳐 papers 엔티티 생성
          arxivId:       a.arxivId,
          title:         a.title,
          authors:       a.authors,
          abstract:      a.abstract,
          category:      a.category,
          pdfUrl:        a.pdfUrl,
          doi:           ss.doi,           // SS에서 가져온 DOI
          publishedDate: ss.publishedDate, // SS에서 가져온 출판일
          citationCount: ss.citationCount, // SS에서 가져온 인용 수
          influenceScore: ss.influenceScore, // SS에서 가져온 영향력 점수
          journal:       ss.journal,       // SS에서 가져온 저널명
        });
      });

      const CHUNK = 500; // 한 번에 저장할 최대 레코드 수 (대량 저장 시 메모리/쿼리 부하 분산)
      for (let i = 0; i < newPapers.length; i += CHUNK) { // CHUNK 단위로 나눠서 저장
        await this.papersRepository.save(newPapers.slice(i, i + CHUNK)); // 현재 청크 저장
      }
    }

    const saved = toInsert.length; // 저장된 논문 수

    return { total: joined.length, saved, alreadyExists }; // 통합 결과 반환
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. citationCount / influenceScore 갱신
  // ══════════════════════════════════════════════════════════════════

  async updateStats() {
    // ── 1. papers 전체 조회 (기존값 비교용) ──────────────────────────────
    const allPapers = await this.papersRepository.find({
      select: ['arxivId', 'citationCount', 'influenceScore'], // 비교에 필요한 필드만 조회 (불필요한 데이터 로딩 방지)
    });
    const papersMap = new Map(allPapers.map((p) => [p.arxivId, p])); // arxivId → papers 레코드 Map (변경 여부 비교용)
    // papersMap 예시
    // Map {
    //   "2301.00001" => { 논문 정보 },
    //   "2301.00002" => { 논문 정보 },
    //   ...
    // }
    const allArxivIds = allPapers.map((p) => p.arxivId); // 갱신 대상 arXiv ID 전체 목록

    let totalUpdated = 0; // 실제 값이 변경된 논문 수
    let totalNotFound = 0; // SS에서 찾지 못한 논문 수

    // ── 2. SS API 배치 호출 → 기존값과 비교 후 변경된 것만 갱신 ──────────
    for (let i = 0; i < allArxivIds.length; i += SS2_BATCH_SIZE) { // SS2_BATCH_SIZE 단위로 배치 처리
      const batch = allArxivIds.slice(i, i + SS2_BATCH_SIZE); // 현재 배치의 arXiv ID 목록

      //  Semantic Scholar API 키
      const SS2_API_KEY = this.configService.get<string>(envVariableKeys.semanticScholarApi) as string

      const response = await fetch(`${SS2_BATCH_URL}?fields=${SS2_UPDATE_FIELDS}`, { // SS 배치 API 호출 (갱신용 필드만 요청)
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': SS2_API_KEY },
        body: JSON.stringify({ ids: batch.map((id) => `ArXiv:${id}`) }), // arXiv ID를 SS 형식으로 변환
      });

      if (!response.ok) { // API 요청 실패 시
        if (i + SS2_BATCH_SIZE < allArxivIds.length) await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 딜레이
        continue; // 이 배치 건너뜀
      }

      const data: (any | null)[] = await response.json(); // 응답 파싱 (찾지 못한 논문은 null)
      const notFoundCount = data.filter((p) => p === null).length; // null 개수 = SS에서 찾지 못한 논문 수
      totalNotFound += notFoundCount; // 누적

      // 기존값과 비교해서 실제 변경된 것만 추출
      const changedData = data
        .map((paper, idx) => ({ paper, arxivId: batch[idx] })) // 응답 데이터와 arXiv ID를 쌍으로 묶음
        .filter((item): item is { paper: any; arxivId: string } => { // null 제거 + 타입 가드
          if (item.paper === null) return false; // SS에서 찾지 못한 논문 제외
          const existing = papersMap.get(item.arxivId); // 기존 DB 값 가져오기
          if (!existing) return false; // papers 테이블에 없으면 제외
          const newCitation  = item.paper.citationCount ?? null; // SS에서 새로 받은 인용 수
          const newInfluence = item.paper.influentialCitationCount ?? null; // SS에서 새로 받은 영향력 점수
          return (
            newCitation  !== existing.citationCount || // 인용 수가 변경됐거나
            newInfluence !== existing.influenceScore   // 영향력 점수가 변경된 경우만 포함
          );
        });

      if (changedData.length > 0) { // 실제 변경된 데이터가 있을 때만 저장
        // ── 트랜잭션 시작: raw_semantic_scholar와 papers를 하나의 단위로 처리 ──
        const qr = this.dataSource.createQueryRunner(); // 트랜잭션 관리용 QueryRunner 생성
        await qr.connect(); // DB 커넥션 확보
        await qr.startTransaction(); // 트랜잭션 시작

        try {
          // raw_semantic_scholar 갱신
          await qr.manager.save( // 트랜잭션 내에서 저장 (queryRunner.manager 사용)
            RawSemanticScholar,
            changedData.map(({ paper, arxivId }) =>
              this.ss2Repository.create({ // 변경된 필드만 담은 부분 엔티티 생성
                ss2Id:          paper.paperId,
                arxivId,
                citationCount:  paper.citationCount ?? undefined,  // null이면 undefined로 변환 (TypeORM은 undefined는 업데이트 제외)
                influenceScore: paper.influentialCitationCount ?? undefined,
              } as DeepPartial<RawSemanticScholar>), // 일부 필드만 있는 객체임을 TypeORM에 알림
            ),
          );

          // papers 갱신
          await qr.manager.save(
            Papers,
            changedData.map(({ paper, arxivId }) =>
              this.papersRepository.create({
                arxivId,
                citationCount:  paper.citationCount ?? undefined,
                influenceScore: paper.influentialCitationCount ?? undefined,
              } as DeepPartial<Papers>),
            ),
          );

          // 두 테이블 모두 성공 시 커밋
          await qr.commitTransaction(); // 변경사항을 DB에 확정
          totalUpdated += changedData.length; // 성공한 경우에만 카운터 증가
        } catch (err) {
          // 하나라도 실패하면 양쪽 모두 롤백
          await qr.rollbackTransaction(); // 트랜잭션 내 모든 변경사항 취소
        } finally {
          // 성공/실패 무관하게 커넥션 반환
          await qr.release(); // QueryRunner가 점유한 커넥션을 풀에 반납
        }
        // ── 트랜잭션 종료 ─────────────────────────────────────────────────────
      }

      if (i + SS2_BATCH_SIZE < allArxivIds.length) await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 딜레이
    }

    return { total: allArxivIds.length, updated: totalUpdated, notFound: totalNotFound }; // 갱신 결과 반환
  }

  // ── arXiv id_list API 호출 → 파싱만 수행 ─────────────────────────────────
  private async fetchArxivEntries(arxivIds: string[]) {
    if (arxivIds.length === 0) return []; // 입력이 없으면 빈 배열 반환
    const result: ArxivParsed[] = []; // 파싱된 논문을 담을 배열

    for (let i = 0; i < arxivIds.length; i += ARXIV_ID_BATCH_SIZE) { // ARXIV_ID_BATCH_SIZE 단위로 배치 요청
      const batch = arxivIds.slice(i, i + ARXIV_ID_BATCH_SIZE); // 현재 배치의 arXiv ID 목록
      const url = `${ARXIV_API_BASE}?id_list=${batch.join(',')}&max_results=${batch.length}`; // ID 목록을 쉼표로 연결해 URL 구성

      const res = await fetch(url); // arXiv API 요청
      if (!res.ok) { // 요청 실패 시
        if (i + ARXIV_ID_BATCH_SIZE < arxivIds.length) await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 딜레이 후
        continue; // 이 배치 건너뜀
      }

      // fetchArxiv()와 거의 유사
      const xmlText = await res.text(); // XML 응답 텍스트 읽기
      const parsed = await parseStringPromise(xmlText, { explicitArray: true }); // XML → JS 객체 변환. explicitArray: true - XML 태그를 파싱할 때 값을 항상 배열(Array) 형태로 만들어라
      const entries: any[] = parsed?.feed?.entry ?? []; // 논문 항목 추출

      for (const entry of entries) { // 각 논문 항목 파싱
        const idUrl: string = entry.id?.[0] ?? ''; // arXiv URL 형태 ID
        const arxivId = idUrl.split('/').pop()?.replace(/v\d+$/, ''); // 버전 없는 순수 arXiv ID 추출
        if (!arxivId) continue; // ID 없으면 건너뜀

        const links: any[] = entry.link ?? [];
        const pdfLink = links.find((l) => l.$?.type === 'application/pdf'); // PDF 링크 찾기
        if (!pdfLink) continue; // PDF 없으면 건너뜀

        const title    = (entry.title?.[0] ?? '').replace(/\s+/g, ' ').trim();
        const authors  = (entry.author ?? []).map((a: any) => a.name?.[0] as string).filter(Boolean);
        const abstract = (entry.summary?.[0] ?? '').replace(/\s+/g, ' ').trim();
        const categories = (entry.category ?? []).map((c: any) => c.$.term as string);

        result.push({ arxivId, title, authors, abstract, categories, pdfUrl: pdfLink.$.href }); // 파싱 결과를 배열에 추가
      }

      if (i + ARXIV_ID_BATCH_SIZE < arxivIds.length) await this.delay(REQUEST_DELAY_MS); // 마지막 배치가 아니면 딜레이
    }

    return result; // 파싱된 논문 배열 반환
  }

  // ── ArxivParsed 배열 → raw_arxiv 저장 ────────────────────────────────────
  private async saveArxivEntries(entries: ArxivParsed[]) {
    if (entries.length === 0) return { saved: 0, alreadyExists: 0 }; // 입력이 없으면 즉시 반환

    const ids = entries.map((e) => e.arxivId); // 저장하려는 arXiv ID 목록
    const existing = await this.arxivRepository.findBy({ arxivId: In(ids) }); // DB에 이미 있는 레코드 조회
    const existingSet = new Set(existing.map((r) => r.arxivId)); // 중복 검사용 Set
    const alreadyExists = existingSet.size; // 이미 존재하는 수

    const newRecords = entries
      .filter((e) => !existingSet.has(e.arxivId)) // DB에 없는 논문만 필터링
      .map((e) =>
        this.arxivRepository.create({ // 엔티티 인스턴스 생성
          arxivId:  e.arxivId,
          title:    e.title,
          authors:  e.authors,
          abstract: e.abstract,
          category: e.categories,
          pdfUrl:   e.pdfUrl,
        }),
      );

    if (newRecords.length > 0) await this.arxivRepository.save(newRecords); // 새 레코드가 있을 때만 저장
    return { saved: newRecords.length, alreadyExists }; // 저장 결과 반환
  }

  // ── SS2 응답 → Entity 매핑 ────────────────────────────────────────────────
  private mapToPaper(data: any, arxivId: string): RawSemanticScholar {
    const journal: string | null =
      (data.journal?.name as string | undefined) ??         // journal 필드에서 이름 추출 시도
      (data.publicationVenue?.name as string | undefined) ?? // 없으면 publicationVenue에서 추출 시도
      null; // 둘 다 없으면 null

    const publishedDate: string | null =
      (data.publicationDate as string | undefined) ??        // publicationDate 필드 우선 사용
      (data.year != null ? String(data.year) : null);        // 없으면 year 필드를 문자열로 변환해 사용

    return this.ss2Repository.create({ // RawSemanticScholar 엔티티 인스턴스 생성
      ss2Id:         data.paperId as string,                               // SS 고유 ID
      doi:           (data.externalIds?.DOI as string | undefined) ?? undefined, // DOI (없으면 undefined)
      publishedDate: publishedDate ?? undefined,                           // 출판일 (없으면 undefined)
      citationCount: (data.citationCount as number | undefined) ?? undefined,    // 인용 수
      influenceScore: (data.influentialCitationCount as number | undefined) ?? undefined, // 영향력 점수
      arxivId,                                                             // arXiv ID
      journal:       journal ?? undefined,                                 // 저널명
    } as DeepPartial<RawSemanticScholar>); // 일부 필드만 있는 객체임을 명시
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms)); // ms 밀리초 후 resolve되는 Promise 반환 (await와 함께 사용해 실행을 일시 중단)
  }
}
