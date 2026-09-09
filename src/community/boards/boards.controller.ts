import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
} from '@nestjs/swagger';
import type { QueryRunner as QR } from 'typeorm';
import { BoardsService } from './boards.service';
import { CreateBoardCategoryDto } from './dto/create-board-category.dto';
import { UpdateBoardCategoryDto } from './dto/update-board-category.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { GetPostsPaginationDto } from './dto/get-posts-pagination.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';
import { User } from 'src/users/decorator/user.decorator';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';

@Controller('community/boards')
@ApiBearerAuth()
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  // ===== 게시판 종류(카테고리) =====

  @Get('categories')
  @ApiOperation({ description: '게시판 종류 목록을 가져오는 API' })
  getBoardCategories() {
    return this.boardsService.getBoardCategories();
  }

  @Post('categories')
  @ApiOperation({ description: '게시판 종류를 생성하는 API(관리자 권한)' })
  @ApiExcludeEndpoint()
  @Roles(RolesEnum.ADMIN)
  createBoardCategory(@Body() dto: CreateBoardCategoryDto) {
    return this.boardsService.createBoardCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({
    description: 'id 기반 게시판 종류를 수정하는 API(관리자 권한)',
  })
  @ApiExcludeEndpoint()
  @Roles(RolesEnum.ADMIN)
  updateBoardCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBoardCategoryDto,
  ) {
    return this.boardsService.updateBoardCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({
    description:
      'id 기반 게시판 종류를 삭제하는 API(관리자 권한, 소속 게시물이 있으면 삭제 불가)',
  })
  @ApiExcludeEndpoint()
  @Roles(RolesEnum.ADMIN)
  deleteBoardCategory(@Param('id', ParseIntPipe) id: number) {
    return this.boardsService.deleteBoardCategory(id);
  }

  // ===== 게시물 =====

  @Get('posts')
  @ApiOperation({
    description:
      '게시물 목록을 가져오는 API(카테고리/키워드/정렬/페이지네이션)',
  })
  getPosts(@Query() dto: GetPostsPaginationDto) {
    return this.boardsService.getPosts(dto);
  }

  @Post('posts')
  @ApiOperation({ description: '게시물을 작성하는 API' })
  createPost(@Body() dto: CreatePostDto, @User('id') userId: number) {
    return this.boardsService.createPost(userId, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ description: 'id 기반 게시물 상세 조회 API' })
  getPostDetail(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
  ) {
    return this.boardsService.getPostDetail(id, userId);
  }

  @Patch('posts/:id')
  @ApiOperation({
    description: '본인이 작성한 게시물을 수정하는 API(카테고리 변경 포함)',
  })
  updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @User('id') userId: number,
  ) {
    return this.boardsService.updatePost(userId, id, dto);
  }

  @Delete('posts/:id')
  @ApiOperation({
    description:
      '본인이 작성한 게시물을 삭제하는 API(관리자는 모든 게시물 삭제 가능)',
  })
  @UseInterceptors(TransactionInterceptor)
  deletePost(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @User('role') role: RolesEnum,
    @QueryRunner() qr: QR,
  ) {
    return this.boardsService.deletePost(userId, id, role, qr);
  }

  @Post('posts/:id/likeToggle')
  @ApiOperation({ description: '게시물 좋아요를 표시/해제하는 API' })
  @UseInterceptors(TransactionInterceptor)
  togglePostLike(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.boardsService.togglePostLike(userId, id, qr);
  }

  // ===== 댓글/대댓글 =====

  @Get('posts/:postId/comments')
  @ApiOperation({ description: '게시물의 댓글/대댓글 목록을 가져오는 API' })
  getComments(
    @Param('postId', ParseIntPipe) postId: number,
    @User('id') userId: number,
  ) {
    return this.boardsService.getComments(postId, userId);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({
    description: '댓글 또는 대댓글을 작성하는 API(parentId 있으면 대댓글)',
  })
  createComment(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
    @User('id') userId: number,
  ) {
    return this.boardsService.createComment(userId, postId, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ description: '본인이 작성한 댓글/대댓글을 수정하는 API' })
  updateComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
    @User('id') userId: number,
  ) {
    return this.boardsService.updateComment(userId, id, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({
    description:
      '본인이 작성한 댓글/대댓글을 삭제하는 API(관리자는 모든 댓글 삭제 가능)',
  })
  deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @User('role') role: RolesEnum,
  ) {
    return this.boardsService.deleteComment(userId, id, role);
  }

  @Post('comments/:id/likeToggle')
  @ApiOperation({ description: '댓글/대댓글 좋아요를 표시/해제하는 API' })
  @UseInterceptors(TransactionInterceptor)
  toggleCommentLike(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.boardsService.toggleCommentLike(userId, id, qr);
  }
}
