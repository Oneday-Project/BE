import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  Not,
  QueryFailedError,
  QueryRunner,
  Repository,
} from 'typeorm';
import { CommonService } from 'src/common/common.service';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { AlumniPost } from './entities/alumni-post.entity';
import { AlumniComment } from './entities/alumni-comment.entity';
import { AlumniPostLike } from './entities/alumni-post-like.entity';
import { AlumniCommentLike } from './entities/alumni-comment-like.entity';
import { CreateAlumniPostDto } from './dto/create-alumni-post.dto';
import { UpdateAlumniPostDto } from './dto/update-alumni-post.dto';
import { GetAlumniPostsPaginationDto } from './dto/get-alumni-posts-pagination.dto';
import { CreateAlumniCommentDto } from './dto/create-alumni-comment.dto';
import { UpdateAlumniCommentDto } from './dto/update-alumni-comment.dto';
import { RolesEnum } from 'src/users/const/roles.const';
import { User } from 'src/users/entities/users.entity';
import { AiServicesService } from 'src/ai-services/ai-services.service';

@Injectable()
export class AlumniService {
  constructor(
    @InjectRepository(AlumniPost)
    private readonly postRepository: Repository<AlumniPost>,
    @InjectRepository(AlumniComment)
    private readonly commentRepository: Repository<AlumniComment>,
    @InjectRepository(AlumniPostLike)
    private readonly postLikeRepository: Repository<AlumniPostLike>,
    @InjectRepository(AlumniCommentLike)
    private readonly commentLikeRepository: Repository<AlumniCommentLike>,
    @InjectRepository(ResearchField)
    private readonly researchFieldRepository: Repository<ResearchField>,
    private readonly commonService: CommonService,
    private readonly aiServicesService: AiServicesService,
  ) {}

  // ===== 게시물 =====

  async createPost(userId: number, dto: CreateAlumniPostDto) {
    const { researchFieldIds, ...rest } = dto;
    const researchFields = await this.resolveResearchFields(researchFieldIds);

    const post = this.postRepository.create({
      ...rest,
      gradSchoolName: this.normalizeGradSchoolName(rest.gradSchoolName),
      authorId: userId,
      researchFields,
    });

    const saved = await this.postRepository.save(post);

    // 챗봇이 이 글도 검색할 수 있게 임베딩을 만든다. 실패해도 글 작성은 그대로 성공한다.
    await this.aiServicesService.syncAlumniPostEmbedding(saved.id);

    const created = await this.postQueryBuilder()
      .where('post.id = :id', { id: saved.id })
      .getOne();

    return { ...created!, author: this.toAuthorSummary(created!.author) };
  }

  async updatePost(userId: number, postId: number, dto: UpdateAlumniPostDto) {
    const post = await this.postRepository.findOne({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        '본인이 작성한 게시물만 수정할 수 있습니다.',
      );
    }

    const { researchFieldIds, ...rest } = dto;

    // null/undefined는 둘 다 "안 바꾼다"는 뜻으로 취급한다(class-validator의 @IsOptional()도
    // null과 undefined를 동일하게 "미입력"으로 보고 이후 검증(@ArrayMinSize 등)을 건너뛰기 때문에,
    // researchFieldIds: null이 그대로 들어오면 검증 없이 resolveResearchFields(null)까지 도달해버린다)
    if (researchFieldIds) {
      post.researchFields = await this.resolveResearchFields(researchFieldIds);
    }

    if (rest.gradSchoolName !== undefined) {
      rest.gradSchoolName = this.normalizeGradSchoolName(rest.gradSchoolName);
    }

    Object.assign(post, rest);

    await this.postRepository.save(post);

    // 임베딩에 넣는 값(제목·본문·진학한 대학원/학과·분야 태그)이 바뀐 경우에만 다시 만든다.
    if (
      rest.title !== undefined ||
      rest.content !== undefined ||
      rest.gradSchoolName !== undefined ||
      rest.gradSchoolDept !== undefined ||
      researchFieldIds
    ) {
      await this.aiServicesService.syncAlumniPostEmbedding(postId);
    }

    const updated = await this.postQueryBuilder()
      .where('post.id = :id', { id: postId })
      .getOne();

    return { ...updated!, author: this.toAuthorSummary(updated!.author) };
  }

  async deletePost(
    userId: number,
    postId: number,
    role: RolesEnum,
    qr: QueryRunner,
  ) {
    const postRepository = qr.manager.getRepository<AlumniPost>(AlumniPost);
    const commentRepository =
      qr.manager.getRepository<AlumniComment>(AlumniComment);

    const post = await postRepository.findOne({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    if (post.authorId !== userId && role !== RolesEnum.ADMIN) {
      throw new ForbiddenException(
        '본인이 작성한 게시물만 삭제할 수 있습니다.',
      );
    }

    // AlumniComment.parent가 RESTRICT라서(대댓글 있는 댓글은 하드 삭제 금지) Post -> Comment
    // CASCADE에 그냥 맡기면 삭제 순서에 따라 FK 위반이 날 수 있다. 대댓글을 먼저 지우고 댓글을
    // 지운 뒤 게시물을 지워서 순서를 직접 보장한다(좋아요는 CASCADE로 함께 삭제됨).
    await commentRepository.delete({ postId, parentId: Not(IsNull()) });
    await commentRepository.delete({ postId });
    await postRepository.delete(postId);

    return true;
  }

  async getPosts(dto: GetAlumniPostsPaginationDto) {
    const { researchFieldId, keyword } = dto;

    const qb = this.postQueryBuilder();

    if (researchFieldId) {
      const tagSubQb = this.postRepository
        .createQueryBuilder('post')
        .select('post.id')
        .leftJoin('post.researchFields', 'researchField')
        .where('researchField.id = :researchFieldId', { researchFieldId })
        .distinct(true);

      qb.andWhere(`post.id IN (${tagSubQb.getQuery()})`).setParameters({
        ...qb.getParameters(),
        ...tagSubQb.getParameters(),
      });
    }

    if (keyword) {
      qb.andWhere(
        '(post.title ILIKE :keyword OR post.content ILIKE :keyword)',
        {
          keyword: `%${this.escapeLikePattern(keyword)}%`,
        },
      );
    }

    // 정렬을 바꿨는데 이전 정렬 기준으로 만들어진 cursor를 그대로 들고 오면 cursorPagination이
    // cursor에 인코딩된 order로 조용히 덮어써버려 방금 바꾼 정렬이 무시된다.
    // cursor의 정렬 기준이 지금 요청한 정렬과 다르면 그 cursor는 버리고 처음부터 다시 조회한다.
    if (dto.cursor && !this.cursorMatchesOrder(dto.cursor, dto.order)) {
      dto.cursor = undefined;
    }

    // page를 주면 페이지 기반, 안 주면 커서 기반 페이지네이션(둘 다 지원, 게시판과 동일한 방식)
    const result = dto.page
      ? await this.commonService.pagePagination(qb, dto)
      : await this.commonService.cursorPagination(qb, dto);

    return {
      ...result,
      data: result.data.map((post) => ({
        ...post,
        author: this.toAuthorSummary(post.author),
      })),
    };
  }

  async getPostDetail(postId: number, userId: number) {
    const post = await this.postQueryBuilder()
      .where('post.id = :id', { id: postId })
      .getOne();

    if (!post) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    const isLiked = await this.postLikeRepository.exists({
      where: { postId, userId },
    });

    return { ...post, author: this.toAuthorSummary(post.author), isLiked };
  }

  async togglePostLike(userId: number, postId: number, qr: QueryRunner) {
    const postRepository = qr.manager.getRepository<AlumniPost>(AlumniPost);
    const postLikeRepository =
      qr.manager.getRepository<AlumniPostLike>(AlumniPostLike);

    const postExists = await postRepository.exists({ where: { id: postId } });

    if (!postExists) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    const likeExists = await postLikeRepository.exists({
      where: { postId, userId },
    });

    if (likeExists) {
      const deleteResult = await postLikeRepository.delete({ postId, userId });

      // 동시 요청으로 이미 지워졌다면 카운트를 중복으로 내리지 않는다
      if (deleteResult.affected) {
        await postRepository.decrement({ id: postId }, 'likeCount', 1);
      }

      return { isLiked: false };
    }

    try {
      await postLikeRepository.save({ postId, userId });
    } catch (e) {
      // 동시 요청(더블클릭 등)이 먼저 좋아요를 눌렀다면 PK 중복 에러가 난다.
      // 사용자가 원한 결과("좋아요 켜짐")는 이미 이뤄진 상태이므로 성공으로 응답한다.
      if (this.isUniqueViolation(e)) {
        return { isLiked: true };
      }
      throw e;
    }

    await postRepository.increment({ id: postId }, 'likeCount', 1);

    return { isLiked: true };
  }

  // ===== 댓글/대댓글 =====

  async toggleCommentLike(userId: number, commentId: number, qr: QueryRunner) {
    const commentRepository =
      qr.manager.getRepository<AlumniComment>(AlumniComment);
    const commentLikeRepository =
      qr.manager.getRepository<AlumniCommentLike>(AlumniCommentLike);

    const comment = await commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('존재하지 않는 댓글입니다!');
    }

    const likeExists = await commentLikeRepository.exists({
      where: { commentId, userId },
    });

    // 좋아요 취소는 댓글이 삭제된 상태여도 항상 허용한다(이미 누른 좋아요를 영구히 못 지우게 되면 안 됨)
    if (likeExists) {
      const deleteResult = await commentLikeRepository.delete({
        commentId,
        userId,
      });

      // 동시 요청으로 이미 지워졌다면 카운트를 중복으로 내리지 않는다
      if (deleteResult.affected) {
        await commentRepository.decrement({ id: commentId }, 'likeCount', 1);
      }

      return { isLiked: false };
    }

    if (comment.isDeleted) {
      throw new BadRequestException(
        '삭제된 댓글에는 좋아요를 누를 수 없습니다.',
      );
    }

    try {
      await commentLikeRepository.save({ commentId, userId });
    } catch (e) {
      // 동시 요청(더블클릭 등)이 먼저 좋아요를 눌렀다면 PK 중복 에러가 난다.
      // 사용자가 원한 결과("좋아요 켜짐")는 이미 이뤄진 상태이므로 성공으로 응답한다.
      if (this.isUniqueViolation(e)) {
        return { isLiked: true };
      }
      throw e;
    }

    await commentRepository.increment({ id: commentId }, 'likeCount', 1);

    return { isLiked: true };
  }

  async createComment(
    userId: number,
    postId: number,
    dto: CreateAlumniCommentDto,
  ) {
    const postExists = await this.postRepository.exists({
      where: { id: postId },
    });

    if (!postExists) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    if (dto.parentId) {
      // 게시물에 달린 댓글에 대댓글을 달려고 하는 경우
      const parent = await this.commentRepository.findOne({
        where: { id: dto.parentId, postId },
      });

      if (!parent) {
        throw new NotFoundException('존재하지 않는 댓글입니다!');
      }

      if (parent.parentId) {
        // 대댓글이면..
        throw new BadRequestException('대댓글에는 답글을 달 수 없습니다.'); //대대댓글 불가능
      }

      if (parent.isDeleted) {
        throw new BadRequestException('삭제된 댓글에는 답글을 달 수 없습니다.');
      }
    }

    const comment = this.commentRepository.create({
      postId,
      authorId: userId,
      content: dto.content,
      parentId: dto.parentId, // 대댓글이면 여기에 null이 아닌 상위 댓글의 id가 들어감.
    });

    const saved = await this.commentRepository.save(comment);

    const created = await this.commentQueryBuilder()
      .where('comment.id = :id', { id: saved.id })
      .getOne();

    return { ...created!, author: this.toAuthorSummary(created!.author) };
  }

  async updateComment(
    userId: number,
    commentId: number,
    dto: UpdateAlumniCommentDto,
  ) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('존재하지 않는 댓글입니다!');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('본인이 작성한 댓글만 수정할 수 있습니다.');
    }

    if (comment.isDeleted) {
      throw new BadRequestException('삭제된 댓글은 수정할 수 없습니다.');
    }

    comment.content = dto.content;

    await this.commentRepository.save(comment);

    const updated = await this.commentQueryBuilder()
      .where('comment.id = :id', { id: commentId })
      .getOne();

    return { ...updated!, author: this.toAuthorSummary(updated!.author) };
  }

  async deleteComment(userId: number, commentId: number, role: RolesEnum) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('존재하지 않는 댓글입니다!');
    }

    if (comment.authorId !== userId && role !== RolesEnum.ADMIN) {
      throw new ForbiddenException('본인이 작성한 댓글만 삭제할 수 있습니다.');
    }

    // 대댓글이 남아있는지 미리 조회해서 판단하면 그 사이에 대댓글이 새로 달릴 수 있다(TOCTOU).
    // 그냥 하드 삭제를 시도하고, 자기참조 FK(RESTRICT)에 걸리면 그때 소프트 삭제로 대체한다
    // (에브리타임처럼 "삭제된 댓글입니다"로 표시, 대댓글은 유지).
    try {
      await this.commentRepository.delete(commentId);
    } catch (e) {
      if (this.isForeignKeyViolation(e)) {
        await this.commentRepository.update(commentId, { isDeleted: true });
      } else {
        throw e;
      }
    }

    return true;
  }

  async getComments(postId: number, userId: number) {
    const postExists = await this.postRepository.exists({
      where: { id: postId },
    });

    if (!postExists) {
      throw new NotFoundException('존재하지 않는 게시물입니다!');
    }

    const comments = await this.commentQueryBuilder()
      .where('comment.postId = :postId', { postId })
      .orderBy('comment.createdAt', 'ASC')
      .getMany();

    // 현재 로그인한 사용자가 좋아요 누른 댓글 id들을 한 번에 조회(N+1 방지)
    const myLikes =
      comments.length === 0
        ? []
        : await this.commentLikeRepository.find({
            where: {
              userId,
              commentId: In(comments.map((comment) => comment.id)),
            },
          });
    const likedCommentIds = new Set(myLikes.map((like) => like.commentId));

    // 삭제된 댓글은 화면에 표시할 내용만 치환하고, 데이터는 그대로 둔다(대댓글이 참조하고 있기 때문)
    const withPlaceholder = comments.map((comment) => ({
      ...comment,
      content: comment.isDeleted ? '삭제된 댓글입니다.' : comment.content,
      author: this.toAuthorSummary(comment.author),
      isLiked: likedCommentIds.has(comment.id),
    }));

    // 부모 id별로 대댓글을 한 번의 순회로 묶는다(매 최상위 댓글마다 전체를 다시 훑지 않도록)
    const repliesByParentId = new Map<number, typeof withPlaceholder>();
    for (const comment of withPlaceholder) {
      if (!comment.parentId) continue;
      const replies = repliesByParentId.get(comment.parentId) ?? [];
      replies.push(comment);
      repliesByParentId.set(comment.parentId, replies);
    }

    return withPlaceholder
      .filter((comment) => !comment.parentId)
      .map((comment) => ({
        ...comment,
        replies: repliesByParentId.get(comment.id) ?? [],
      }));
  }

  private async resolveResearchFields(ids: number[]) {
    // 빈 배열이면 In([])이 "일치하는 행 없음"으로 조용히 통과해버려서, 검증 없이 태그가
    // 전부 비워질 수 있다. 태그는 항상 1개 이상이어야 하므로 여기서 명확하게 막는다.
    if (ids.length === 0) {
      throw new BadRequestException('분야 태그를 1개 이상 선택해주세요.');
    }

    const researchFields = await this.researchFieldRepository.findBy({
      id: In(ids),
    });

    if (researchFields.length !== ids.length) {
      throw new NotFoundException(
        '존재하지 않는 분야 태그가 포함되어 있습니다!',
      );
    }

    return researchFields;
  }

  // 명시적으로 null/빈 문자열을 보내면 "비공개"로 정규화한다. 생략(undefined)하면 DB 기본값이
  // 적용되지만, null을 그대로 저장하면 DB 기본값이 적용되지 않고 실제 NULL이 들어가버리므로
  // 여기서 직접 처리한다.
  private normalizeGradSchoolName(value: string | null | undefined): string {
    return value && value.trim() ? value : '비공개';
  }

  // 게시판에서는 실명(username)/이메일 대신 nickname만 노출한다
  private toAuthorSummary(author: User) {
    return { id: author.id, nickname: author.nickname };
  }

  // author는 nickname만 쓰므로 매번 User 전체 컬럼(비밀번호 해시 포함)을 긁어오지 않도록 컬럼을 제한한다
  private postQueryBuilder() {
    return this.postRepository
      .createQueryBuilder('post')
      .leftJoin('post.author', 'author')
      .addSelect(['author.id', 'author.nickname'])
      .leftJoinAndSelect('post.researchFields', 'researchFields');
  }

  private commentQueryBuilder() {
    return this.commentRepository
      .createQueryBuilder('comment')
      .leftJoin('comment.author', 'author')
      .addSelect(['author.id', 'author.nickname']);
  }

  // LIKE/ILIKE 와일드카드(%, _)를 리터럴로 이스케이프한다(검색어에 %가 들어있어도 와일드카드로 해석되지 않도록)
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  // cursor에 인코딩된 정렬 기준(첫 컬럼)이 지금 요청한 order와 같은지 확인한다
  private cursorMatchesOrder(cursor: string, order: string[]): boolean {
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf-8'),
      ) as { order?: unknown };
      return Array.isArray(decoded.order) && decoded.order[0] === order[0];
    } catch {
      return false;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23505';
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23503';
  }
}
