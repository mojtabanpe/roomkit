import { ServiceUnavailableException } from '@nestjs/common';
import { Tenant } from '../database/entities/tenant.entity';
import { RecordingsService } from './recordings.service';

/**
 * Recording is deliberately not wired up on roomkit.ir, so what matters here is
 * the *shape* of saying no: a tenant must get 503 and no row, never a 500 and
 * never a row that can never become a file.
 */
describe('RecordingsService — recorder availability', () => {
  const tenant = { id: 'tenant-1', key: 'store' } as Tenant;

  const build = (env: Record<string, string | undefined>) => {
    const repo = {
      existsBy: jest.fn().mockResolvedValue(false),
      create: jest.fn((row) => row),
      save: jest.fn((row) => Promise.resolve(row)),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const livekit = {
      startRoomRecording: jest.fn(),
      stopRecording: jest.fn(),
    };
    const config = { get: (key: string) => env[key] };
    const service = new RecordingsService(
      repo as never,
      livekit as never,
      config as never,
    );
    return { service, repo, livekit };
  };

  it('answers 503 and starts nothing when no backend is configured', async () => {
    const { service, repo, livekit } = build({});

    await expect(service.start(tenant, 'standup')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(livekit.startRoomRecording).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('answers 503 for a backend it cannot drive, rather than falling through to egress', async () => {
    const { service, livekit } = build({ RECORDER_BACKEND: 'whisper' });

    await expect(service.start(tenant, 'standup')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(livekit.startRoomRecording).not.toHaveBeenCalled();
  });

  it('drives egress once that backend is named', async () => {
    const { service, livekit } = build({ RECORDER_BACKEND: 'egress' });
    livekit.startRoomRecording.mockResolvedValue({ egressId: 'EG_1' });

    const view = await service.start(tenant, 'standup', 'user-42');

    expect(livekit.startRoomRecording).toHaveBeenCalledTimes(1);
    expect(view.status).toBe('starting');
    // Nothing is playable until the webhook settles the job.
    expect(view.playbackUrl).toBeNull();
  });

  it('matches the backend name case-insensitively', async () => {
    const { service, livekit } = build({ RECORDER_BACKEND: 'Egress' });
    livekit.startRoomRecording.mockResolvedValue({ egressId: 'EG_2' });

    await expect(service.start(tenant, 'standup')).resolves.toBeDefined();
    expect(livekit.startRoomRecording).toHaveBeenCalledTimes(1);
  });
});
