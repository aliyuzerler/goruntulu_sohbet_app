import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';

/**
 * RekognitionService — AWS Rekognition ModerateLabels wrapper.
 *
 * Input: image bytes (JPEG/PNG).
 * Output: array of { name, confidence } for moderation labels.
 *
 * Phase 8 dev bypass: if AWS_ACCESS_KEY_ID is empty, returns an empty array
 * (no labels) so CI can test the flow without real AWS.
 *
 * Cost note: each ModerateImage call is ~$0.001 (US-EAST-1). At 1 frame / 15s
 * during a 5-min call = ~20 calls = ~$0.02 per call. Acceptable.
 */
@Injectable()
export class RekognitionService {
  private readonly logger = new Logger(RekognitionService.name);
  private readonly client: RekognitionClient | null;
  private readonly minConfidence: number;
  private readonly nsfwLabels: Set<string>;

  constructor(config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';
    const region = config.get<string>('AWS_REGION') ?? 'us-east-1';
    this.minConfidence = config.get<number>('REKOGNITION_MIN_CONFIDENCE') ?? 60;
    // NSFW labels that trigger automatic action. Configurable via env.
    const labels = (config.get<string>('NSFW_LABELS') ?? 'Explicit Nudity,Suggestive,Explicit Bikini,Adult,Drugs').split(',');
    this.nsfwLabels = new Set(labels.map((l) => l.trim()));

    if (accessKeyId && secretAccessKey) {
      this.client = new RekognitionClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('✓ Rekognition client configured');
    } else {
      this.client = null;
      this.logger.warn('⚠️  AWS not configured — Rekognition returns empty (dev bypass)');
    }
  }

  /**
   * Run ModerateLabels on the given image bytes.
   * Returns the labels that exceed minConfidence.
   */
  async detectLabels(imageBytes: Buffer): Promise<{
    labels: Array<{ name: string; confidence: number }>;
    flagged: boolean;
    raw: unknown;
  }> {
    if (!this.client) {
      return { labels: [], flagged: false, raw: { devBypass: true } };
    }
    const cmd = new DetectModerationLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: this.minConfidence,
    });
    try {
      const res = await this.client.send(cmd);
      const labels = ((res as { ModerationLabels?: Array<{ Name?: string; Confidence?: number }> }).ModerationLabels ?? []).map((l) => ({
        name: l.Name ?? '',
        confidence: l.Confidence ?? 0,
      }));
      // Flag if any label name is in our NSFW set.
      const flagged = labels.some((l) => this.nsfwLabels.has(l.name));
      return { labels, flagged, raw: res };
    } catch (e) {
      this.logger.warn(`Rekognition failed: ${(e as Error).message}`);
      return { labels: [], flagged: false, raw: { error: (e as Error).message } };
    }
  }
}
