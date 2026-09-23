import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionService } from './rekognition.service';
import { StrikeService } from './strike.service';
import { ModerationService } from './moderation.service';
import { CallStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * NsfwPipelineService — captures a frame during a call, uploads to S3,
 * runs Rekognition, and on violation ends the call + applies a strike.
 *
 * Flow (called by the moderation controller when client sends a frame):
 *   1. Validate caller is a participant of the call.
 *   2. Decode base64 frame → bytes.
 *   3. Upload to S3: `moderation/<callId>/<seq>.jpg`.
 *   4. Call Rekognition.detectLabels(bytes).
 *   5. Persist ModerationFrame row.
 *   6. If flagged → end call + applyStrike (reason='nsfw_frame') + createReport (auto-evidence).
 *
 * Phase 8 dev bypass: if S3 not configured, frame is stored in-memory only
 * (still goes through Rekognition if AWS is configured).
 *
 * Cost optimization: client only sends 1 frame / 15s per call → at most
 * 20 frames per 5-min call.
 */
@Injectable()
export class NsfwPipelineService {
  private readonly logger = new Logger(NsfwPipelineService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rekognition: RekognitionService,
    private readonly strike: StrikeService,
    private readonly moderation: ModerationService,
    config: ConfigService,
  ) {
    const accessKey = config.get<string>('S3_ACCESS_KEY') ?? '';
    const secretKey = config.get<string>('S3_SECRET_KEY') ?? '';
    this.bucket = config.get<string>('S3_BUCKET')!;
    if (accessKey && secretKey) {
      this.s3 = new S3Client({
        endpoint: config.get<string>('S3_ENDPOINT'),
        region: config.get<string>('S3_REGION') ?? 'us-east-1',
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE') ?? true,
      });
    } else {
      this.s3 = null;
      this.logger.warn('⚠️  S3 not configured — frames stored in-memory only (dev bypass)');
    }
  }

  async captureFrame(opts: {
    callId: string;
    userId: string;
    frameBase64: string;
  }): Promise<{ flagged: boolean; reason?: string; s3Key?: string }> {
    const call = await this.prisma.call.findUnique({
      where: { id: opts.callId },
      select: { id: true, callerId: true, calleeId: true, status: true },
    });
    if (!call) throw new BadRequestException('Call not found');
    if (call.callerId !== opts.userId && call.calleeId !== opts.userId) {
      throw new BadRequestException('Not a participant');
    }
    if (call.status !== CallStatus.ACTIVE) {
      throw new BadRequestException(`Call not active (status=${call.status})`);
    }

    // Decode frame.
    const bytes = Buffer.from(opts.frameBase64, 'base64');
    if (bytes.length === 0) throw new BadRequestException('Empty frame');

    // Compute next captureSeq for this call.
    const lastSeq = await this.prisma.moderationFrame.findFirst({
      where: { callId: opts.callId },
      orderBy: { captureSeq: 'desc' },
      select: { captureSeq: true },
    });
    const seq = (lastSeq?.captureSeq ?? 0) + 1;

    // Upload to S3.
    const s3Key = `moderation/${opts.callId}/${seq}.jpg`;
    if (this.s3) {
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            Body: bytes,
            ContentType: 'image/jpeg',
          }),
        );
      } catch (e) {
        this.logger.warn(`S3 upload failed: ${(e as Error).message}`);
      }
    }

    // Run Rekognition.
    const rek = await this.rekognition.detectLabels(bytes);

    // Persist ModerationFrame.
    await this.prisma.moderationFrame.create({
      data: {
        callId: opts.callId,
        userId: opts.userId,
        captureSeq: seq,
        s3Key,
        flagged: rek.flagged,
        rekognitionResult: rek.raw as never,
      },
    });

    // On violation → end call + apply strike + create auto-evidence report.
    if (rek.flagged) {
      this.logger.warn(
        `🚨 NSFW frame detected in call ${opts.callId} by user ${opts.userId}`,
      );
      // Determine the OTHER participant for the report target.
      const peerId = call.callerId === opts.userId ? call.calleeId : call.callerId;
      // End the call.
      await this.prisma.call.update({
        where: { id: opts.callId },
        data: {
          status: CallStatus.ENDED,
          endedAt: new Date(),
          endReason: 'moderation',
        },
      });
      // Apply strike (level up — if repeated, escalates to cooldown then ban).
      await this.strike.applyStrike({ userId: opts.userId, reason: 'nsfw_frame' });
      // Create auto-evidence report.
      await this.moderation.createReport({
        reporterId: peerId,
        reportedId: opts.userId,
        callId: opts.callId,
        reason: 'INAPPROPRIATE',
        details: 'Automatic NSFW detection by AWS Rekognition',
        evidence: { frameS3Key: s3Key, rekognitionLabels: rek.labels },
      });
      return { flagged: true, reason: 'nsfw_frame', s3Key };
    }

    return { flagged: false, s3Key };
  }
}
