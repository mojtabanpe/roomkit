import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { join, normalize, sep } from 'node:path';
import { In, Not, Repository } from 'typeorm';
import { Recording } from '../database/entities/recording.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { LivekitService } from '../livekit/livekit.service';
import { livekitRoomName } from '../tenants/room-name';

const OPEN: Recording['status'][] = ['starting', 'active'];
const DEFAULT_LINK_TTL_SECONDS = 6 * 60 * 60;

/**
 * The only recorder this build knows how to drive. Named rather than treated as
 * a boolean because turning recording on is a choice *between* backends, and a
 * typo must not quietly select the one that needs redis.
 */
const EGRESS_BACKEND = 'egress';

export interface RecordingView {
  id: string;
  slug: string;
  status: Recording['status'];
  durationSeconds: number | null;
  sizeBytes: number | null;
  startedByIdentity: string | null;
  createdAt: Date;
  endedAt: Date | null;
  /** Signed, time-limited, and playable straight from a browser. Null until done. */
  playbackUrl: string | null;
}

@Injectable()
export class RecordingsService {
  private readonly log = new Logger(RecordingsService.name);

  constructor(
    @InjectRepository(Recording)
    private readonly recordings: Repository<Recording>,
    private readonly livekit: LivekitService,
    private readonly config: ConfigService,
  ) {}

  async start(
    tenant: Tenant,
    slug: string,
    startedByIdentity?: string,
  ): Promise<RecordingView> {
    this.assertRecorderAvailable();
    const room = livekitRoomName(tenant.key, slug);
    if (await this.recordings.existsBy({ room, status: In(OPEN) })) {
      throw new ConflictException('این جلسه هم‌اکنون در حال ضبط است.');
    }

    // The id is minted before the job so the file name is ours, not LiveKit's —
    // it is what ties a file on disk back to a row without parsing anything.
    const id = randomUUID();
    const relativePath = `${tenant.key}/${slug}/${id}.mp4`;
    const { egressId } = await this.livekit.startRoomRecording(
      room,
      relativePath,
    );

    const row = await this.recordings.save(
      this.recordings.create({
        id,
        tenantId: tenant.id,
        slug,
        room,
        egressId,
        status: 'starting',
        filePath: relativePath,
        startedByIdentity: startedByIdentity ?? null,
      }),
    );
    return this.view(row);
  }

  async stop(tenant: Tenant, slug: string): Promise<RecordingView> {
    const room = livekitRoomName(tenant.key, slug);
    const row = await this.recordings.findOne({
      where: { room, status: In(OPEN) },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new NotFoundException('ضبط فعالی برای این جلسه نیست.');
    // Same gate as `start`: if the backend was switched off under a running
    // job, `remove` is the way out — it stops best-effort and deletes the row.
    this.assertRecorderAvailable();
    await this.livekit.stopRecording(row.egressId);
    return this.view(row);
  }

  async list(tenant: Tenant, slug?: string): Promise<RecordingView[]> {
    const rows = await this.recordings.find({
      where: {
        tenantId: tenant.id,
        ...(slug ? { slug } : {}),
        status: Not('aborted' as const),
      },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.view(row));
  }

  async remove(tenant: Tenant, id: string): Promise<{ ok: true }> {
    const row = await this.recordings.findOne({
      where: { id, tenantId: tenant.id },
    });
    if (!row) throw new NotFoundException('ضبط پیدا نشد.');
    if (OPEN.includes(row.status)) {
      await this.livekit.stopRecording(row.egressId).catch(() => undefined);
    }
    await this.recordings.remove(row);
    return { ok: true };
  }

  /** Called from the LiveKit webhook when an egress job reaches a final state. */
  async settle(
    egressId: string,
    status: Recording['status'],
    detail: { durationSeconds?: number; sizeBytes?: number },
  ): Promise<Recording | null> {
    const row = await this.recordings.findOne({ where: { egressId } });
    if (!row) {
      this.log.warn(`egress ${egressId} finished with no recording row`);
      return null;
    }
    row.status = status;
    row.endedAt = new Date();
    if (detail.durationSeconds !== undefined) {
      row.durationSeconds = Math.round(detail.durationSeconds);
    }
    if (detail.sizeBytes !== undefined) {
      row.sizeBytes = String(detail.sizeBytes);
    }
    return this.recordings.save(row);
  }

  async markActive(egressId: string): Promise<void> {
    await this.recordings.update({ egressId, status: 'starting' }, { status: 'active' });
  }

  /**
   * Resolves a signed playback link back to a file on disk. The signature
   * covers the id *and* the expiry, so neither can be edited independently.
   */
  async resolvePlayback(
    id: string,
    expires: string,
    signature: string,
  ): Promise<{ absolutePath: string; sizeBytes: number | null }> {
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt)) {
      throw new BadRequestException('لینک نامعتبر است.');
    }
    if (Date.now() / 1000 > expiresAt) {
      throw new NotFoundException('این لینک منقضی شده است.');
    }
    if (!this.verify(id, expires, signature)) {
      throw new NotFoundException('لینک نامعتبر است.');
    }

    const row = await this.recordings.findOne({ where: { id } });
    if (!row || row.status !== 'complete' || !row.filePath) {
      throw new NotFoundException('فایل ضبط آماده نیست.');
    }
    return {
      absolutePath: this.absolutePath(row.filePath),
      sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    };
  }

  view(row: Recording): RecordingView {
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      durationSeconds: row.durationSeconds,
      sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
      startedByIdentity: row.startedByIdentity,
      createdAt: row.createdAt,
      endedAt: row.endedAt,
      playbackUrl: row.status === 'complete' ? this.playbackUrl(row.id) : null,
    };
  }

  playbackUrl(id: string, ttlSeconds = DEFAULT_LINK_TTL_SECONDS): string {
    const expires = String(Math.floor(Date.now() / 1000) + ttlSeconds);
    const base = (
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'https://roomkit.ir'
    ).replace(/\/$/, '');
    const query = new URLSearchParams({
      expires,
      signature: this.sign(id, expires),
    });
    return `${base}/api/recordings/${id}/file?${query}`;
  }

  /**
   * Joined and re-checked rather than concatenated: `filePath` comes from our
   * own insert today, but a path that escapes the recordings directory would
   * turn this endpoint into an arbitrary file read.
   */
  private absolutePath(relativePath: string): string {
    const root = this.livekit.recordingsDir();
    const resolved = normalize(join(root, relativePath));
    if (!resolved.startsWith(root.endsWith(sep) ? root : root + sep)) {
      throw new NotFoundException('فایل ضبط پیدا نشد.');
    }
    return resolved;
  }

  private sign(id: string, expires: string): string {
    return createHmac('sha256', this.linkSecret())
      .update(`${id}.${expires}`)
      .digest('hex');
  }

  private verify(id: string, expires: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(id, expires));
    const actual = Buffer.from(signature);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  /**
   * Recording is off until a recorder backend is actually deployed. Fail loudly
   * and early rather than accepting the request and handing back a row that
   * will never become a file — LiveKit would queue an egress nothing consumes.
   *
   * Deliberately not Egress: that needs redis in `livekit.yaml`, which moves
   * LiveKit into distributed mode and puts redis on the room-join path. A
   * recorder outage must cost a recording, never a class.
   */
  private assertRecorderAvailable(): void {
    const backend = this.config.get<string>('RECORDER_BACKEND')?.trim();
    if (!backend) {
      throw new ServiceUnavailableException(
        'سرویس ضبط روی این نصب فعال نیست.',
      );
    }
    if (backend.toLowerCase() !== EGRESS_BACKEND) {
      // A misconfiguration, not a disabled feature — but still 503, because
      // from the tenant's side recording is equally not happening either way.
      this.log.error(
        `RECORDER_BACKEND="${backend}" is not a backend this build can drive; ` +
          `the only recognised value is "${EGRESS_BACKEND}".`,
      );
      throw new ServiceUnavailableException(
        'سرویس ضبط درست پیکربندی نشده است.',
      );
    }
  }

  private linkSecret(): string {
    // Falls back to the LiveKit secret rather than to a constant: an unset
    // variable must not silently make every playback link forgeable.
    const secret =
      this.config.get<string>('RECORDING_LINK_SECRET') ??
      this.config.get<string>('LIVEKIT_API_SECRET');
    if (!secret) {
      throw new BadRequestException('سرویس ضبط پیکربندی نشده است.');
    }
    return secret;
  }
}
