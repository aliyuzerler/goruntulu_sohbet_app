import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProfanityService } from '../users/profanity.service';

/**
 * ChatFilterService — in-call text chat moderation.
 *
 * Two filters:
 *   1. Profanity filter (ProfanityService) — replaces bad words with ***.
 *   2. Link block — detects URLs in the message. If detected, the message
 *      is NOT persisted (just counted for strike accumulation).
 *
 * The filtered message text (with *** for profanity) is persisted in
 * CallChatMessage.content with filtered=true. Blocked messages (links)
 * are not persisted — they're silently dropped, but a counter increments.
 *
 * Phase 8: link detection is naive (regex for http://, https://, www., and
 * bare domain patterns). Phase 9 may switch to a third-party list.
 */
@Injectable()
export class ChatFilterService {
  private readonly logger = new Logger(ChatFilterService.name);
  private readonly profanityEnabled: boolean;
  private readonly linkBlockEnabled: boolean;
  // Naive URL regex — covers most spam patterns.
  private readonly urlRegex = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|app|xyz|me|info|biz))/i;

  constructor(
    private readonly prisma: PrismaService,
    private readonly profanity: ProfanityService,
    config: ConfigService,
  ) {
    this.profanityEnabled = config.get<boolean>('CHAT_PROFANITY_ENABLED') ?? true;
    this.linkBlockEnabled = config.get<boolean>('CHAT_LINK_BLOCK_ENABLED') ?? true;
  }

  /**
   * Process an in-call chat message.
   * Returns the (possibly filtered) content, or null if blocked.
   */
  async processMessage(opts: {
    callId: string;
    senderId: string;
    content: string;
  }): Promise<{ stored: boolean; content: string; filtered: boolean; blockedReason?: string }> {
    // Link block — drop the message entirely.
    if (this.linkBlockEnabled && this.urlRegex.test(opts.content)) {
      this.logger.warn(`🔗 Link blocked from ${opts.senderId} in call ${opts.callId}: "${opts.content}"`);
      // Persist a placeholder message so the UI shows "*** [link blocked]" to the other side.
      const placeholder = '[link blocked]';
      await this.prisma.callChatMessage.create({
        data: {
          callId: opts.callId,
          senderId: opts.senderId,
          content: placeholder,
          filtered: true,
        },
      });
      return { stored: true, content: placeholder, filtered: true, blockedReason: 'link' };
    }

    // Profanity filter — replace words with ***.
    let filtered = false;
    let content = opts.content;
    if (this.profanityEnabled && this.profanity.containsProfanity(content)) {
      content = this.redactProfanity(content);
      filtered = true;
    }

    await this.prisma.callChatMessage.create({
      data: {
        callId: opts.callId,
        senderId: opts.senderId,
        content,
        filtered,
      },
    });
    return { stored: true, content, filtered };
  }

  /** Get all chat messages for a call (admin + chat history UI). */
  async getMessages(callId: string, take = 50): Promise<unknown[]> {
    return this.prisma.callChatMessage.findMany({
      where: { callId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        senderId: true,
        content: true,
        filtered: true,
        createdAt: true,
      },
    });
  }

  /** Simple redaction — Phase 8 uses a small list, Phase 9 may use a better lib. */
  private redactProfanity(text: string): string {
    const bad = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'amk', 'aq', 'sik', 'piç', 'yarrak'];
    let out = text;
    for (const w of bad) {
      const re = new RegExp(w, 'gi');
      out = out.replace(re, '*'.repeat(w.length));
    }
    return out;
  }
}
