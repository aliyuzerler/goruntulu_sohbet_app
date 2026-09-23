import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  CreateReportDto,
  BlockUserDto,
  CaptureFrameDto,
  RateCallDto,
  ChatMessageDto,
  BanUserDto,
  ResolveReportDto,
} from './dto/moderation.dto';
import { ModerationService } from './moderation.service';
import { NsfwPipelineService } from './nsfw-pipeline.service';
import { ChatFilterService } from './chat-filter.service';
import { RatingService } from './rating.service';
import { ReportReason, ReportStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Ip } from '../common/decorators/ip.decorator';

/**
 * ModerationController — Phase 8 moderation endpoints.
 *
 * User routes (JWT auth):
 *   POST   /moderation/report         — single-tap report (auto-evidence)
 *   POST   /moderation/block           — block user (permanent)
 *   POST   /moderation/capture-frame   — NSFW pipeline (frame upload + Rekognition)
 *   POST   /moderation/rate             — post-call star rating
 *   POST   /moderation/chat             — in-call chat message (filtered)
 *
 * Admin routes (JWT + RolesGuard MODERATOR/ADMIN):
 *   GET    /moderation/reports          — report queue (paginated)
 *   POST   /moderation/ban              — manual ban (audit logged)
 *   POST   /moderation/unban            — manual unban (audit logged)
 *   POST   /moderation/resolve/:id      — resolve a report (audit logged)
 */
@Controller('moderation')
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly nsfw: NsfwPipelineService,
    private readonly chat: ChatFilterService,
    private readonly rating: RatingService,
  ) {}

  // ─── User routes ──────────────────────────────────────────────────────

  @Post('report')
  @UseGuards(JwtAuthGuard)
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.moderation.createReport({
      reporterId: user.id,
      reportedId: dto.reportedId,
      callId: dto.callId,
      reason: dto.reason as ReportReason,
      details: dto.note,
    });
  }

  @Post('block')
  @UseGuards(JwtAuthGuard)
  async blockUser(
    @Body() dto: BlockUserDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.moderation.blockUser({ blockerId: user.id, blockedId: dto.blockedId });
    return { blocked: true };
  }

  @Post('capture-frame')
  @UseGuards(JwtAuthGuard)
  async captureFrame(
    @Body() dto: CaptureFrameDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.nsfw.captureFrame({
      callId: dto.callId,
      userId: user.id,
      frameBase64: dto.frameBase64,
    });
  }

  @Post('rate')
  @UseGuards(JwtAuthGuard)
  async rate(
    @Body() dto: RateCallDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.rating.submitRating({
      callId: dto.callId,
      raterId: user.id,
      targetUserId: dto.targetUserId,
      stars: dto.stars,
    });
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async postChat(
    @Body() dto: ChatMessageDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.chat.processMessage({
      callId: dto.callId,
      senderId: user.id,
      content: dto.content,
    });
  }

  // ─── Admin routes ──────────────────────────────────────────────────────

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  async getReports(
    @Query('status') status?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.moderation.getReportQueue({
      status: status as ReportStatus | undefined,
      take: take ? parseInt(take, 10) : 20,
      cursor,
    });
  }

  @Post('ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async banUser(
    @Body() dto: BanUserDto,
    @CurrentUser() user: { id: string; role: string },
    @Ip() ip: string,
  ) {
    await this.moderation.banUser({
      userId: dto.userId,
      adminUserId: user.id,
      reason: dto.reason,
      ip,
    });
    return { banned: true };
  }

  @Post('unban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async unbanUser(
    @Body() dto: BanUserDto,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    await this.moderation.unbanUser({
      userId: dto.userId,
      adminUserId: user.id,
      reason: dto.reason,
      ip,
    });
    return { unbanned: true };
  }

  @Post('resolve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
  ) {
    await this.moderation.resolveReport({
      reportId: id,
      adminUserId: user.id,
      resolution: dto.resolution,
      ip,
    });
    return { resolved: true };
  }
}
