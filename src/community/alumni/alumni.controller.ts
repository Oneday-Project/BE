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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { QueryRunner as QR } from 'typeorm';
import { AlumniService } from './alumni.service';
import { CreateAlumniPostDto } from './dto/create-alumni-post.dto';
import { UpdateAlumniPostDto } from './dto/update-alumni-post.dto';
import { GetAlumniPostsPaginationDto } from './dto/get-alumni-posts-pagination.dto';
import { CreateAlumniCommentDto } from './dto/create-alumni-comment.dto';
import { UpdateAlumniCommentDto } from './dto/update-alumni-comment.dto';
import { RolesEnum } from 'src/users/const/roles.const';
import { User } from 'src/users/decorator/user.decorator';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';

@Controller('community/alumni')
@ApiBearerAuth()
export class AlumniController {
  constructor(private readonly alumniService: AlumniService) {}

  // ===== 게시물 =====

  @Get('posts')
  @ApiOperation({
    description:
      '게시물 목록을 가져오는 API(분야 태그/키워드/정렬/페이지네이션)',
  })
  getPosts(@Query() dto: GetAlumniPostsPaginationDto) {
    return this.alumniService.getPosts(dto);
  }

  @Post('posts')
  @ApiOperation({ description: '게시물을 작성하는 API' })
  createPost(@Body() dto: CreateAlumniPostDto, @User('id') userId: number) {
    return this.alumniService.createPost(userId, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ description: 'id 기반 게시물 상세 조회 API' })
  getPostDetail(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
  ) {
    return this.alumniService.getPostDetail(id, userId);
  }

  @Patch('posts/:id')
  @ApiOperation({ description: '본인이 작성한 게시물을 수정하는 API' })
  updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlumniPostDto,
    @User('id') userId: number,
  ) {
    return this.alumniService.updatePost(userId, id, dto);
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
    return this.alumniService.deletePost(userId, id, role, qr);
  }

  @Post('posts/:id/likeToggle')
  @ApiOperation({ description: '게시물 좋아요를 표시/해제하는 API' })
  @UseInterceptors(TransactionInterceptor)
  togglePostLike(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.alumniService.togglePostLike(userId, id, qr);
  }

  // ===== 댓글/대댓글 =====

  @Get('posts/:postId/comments')
  @ApiOperation({ description: '게시물의 댓글/대댓글 목록을 가져오는 API' })
  getComments(
    @Param('postId', ParseIntPipe) postId: number,
    @User('id') userId: number,
  ) {
    return this.alumniService.getComments(postId, userId);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({
    description: '댓글 또는 대댓글을 작성하는 API(parentId 있으면 대댓글)',
  })
  createComment(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateAlumniCommentDto,
    @User('id') userId: number,
  ) {
    return this.alumniService.createComment(userId, postId, dto);
  }

  @Patch('comments/:id')
  @ApiOperation({ description: '본인이 작성한 댓글/대댓글을 수정하는 API' })
  updateComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlumniCommentDto,
    @User('id') userId: number,
  ) {
    return this.alumniService.updateComment(userId, id, dto);
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
    return this.alumniService.deleteComment(userId, id, role);
  }

  @Post('comments/:id/likeToggle')
  @ApiOperation({ description: '댓글/대댓글 좋아요를 표시/해제하는 API' })
  @UseInterceptors(TransactionInterceptor)
  toggleCommentLike(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.alumniService.toggleCommentLike(userId, id, qr);
  }
}
