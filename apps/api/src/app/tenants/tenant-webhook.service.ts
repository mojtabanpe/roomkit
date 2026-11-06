import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { parseLivekitRoomName } from './room-name';

export type TenantEventName =
  | 'participant_joined'
  | 'participant_left'
  | 'room_finished'
  | 'recording_ready';

export interface TenantEvent {
  event: TenantEventName;
  /** The tenant's own slug, never the namespaced LiveKit room name. */
  room: string;
  at: string;
  identity?: string;
  name?: string;
  recording?: { id: string; url: string | null; durationSeconds: number | null };
}

const TIMEOUT_MS = 5_000;
export const SIGNATURE_HEADER = 'x-roomkit-signature';

/**
 * Pushes room events to the platform that owns the room.
 *
 * Deliberately fire-and-forget: this runs inside the LiveKit webhook handler,
 * and LiveKit retries any non-2xx forever. A tenant whose endpoint is down must
 * not turn into an infinite redelivery loop that buries real failures — so a
 * failed push is logged and dropped, and the tenant's own reconciliation (they
 * still own the join call) is the backstop.
 */
@Injectable()
export class TenantWebhookService {
  private readonly log = new Logger(TenantWebhookService.name);

  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  /**
   * `livekitRoom` is the namespaced name (`acme~standup`); the tenant is
   * resolved from its prefix and only ever sees its own slug.
   */
  async emit(
    livekitRoom: string,
    event: Omit<TenantEvent, 'room'> & { room?: never },
  ): Promise<void> {
    const { tenantKey, slug } = parseLivekitRoomName(livekitRoom);
    if (!tenantKey) return;

    const tenant = await this.tenants
      .createQueryBuilder('tenant')
      .addSelect('tenant.webhookSecret')
      .where('tenant.key = :key', { key: tenantKey })
      .andWhere('tenant.active = true')
      .getOne();
    if (!tenant?.webhookUrl) return;

    const payload: TenantEvent = { ...event, room: slug };
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tenant.webhookSecret) {
      headers[SIGNATURE_HEADER] = sign(body, tenant.webhookSecret);
    }

    try {
      const response = await fetch(tenant.webhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.log.warn(
          `webhook to ${tenant.key} returned HTTP ${response.status} for ${payload.event}`,
        );
      }
    } catch (error) {
      this.log.warn(
        `webhook to ${tenant.key} failed for ${payload.event}: ${String(error)}`,
      );
    }
  }
}

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * Exported so a receiving platform can verify a delivery with the same code
 * that produced it. Compared in constant time — a signature check that leaks
 * timing is a signature check an attacker can walk.
 */
export function verifyTenantWebhook(
  body: string,
  secret: string,
  header: string | undefined,
): boolean {
  if (!header) return false;
  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(header);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}
