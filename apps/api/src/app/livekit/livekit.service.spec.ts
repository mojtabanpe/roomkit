import {
  ParticipantPermission,
  TrackSource,
  TwirpError,
} from 'livekit-server-sdk';
import { LivekitService } from './livekit.service';

describe('LivekitService participant control', () => {
  const admin = {
    getParticipant: jest.fn(),
    updateParticipant: jest.fn(),
    mutePublishedTrack: jest.fn(),
    listParticipants: jest.fn(),
  };
  const service = new LivekitService({} as never);

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(service as never, 'roomAdmin' as never)
      .mockReturnValue(admin as never);
  });

  const notFound = () =>
    new TwirpError('not_found', 'participant not found', 404);

  it('keeps chat and subscribe rights when it grants a microphone', async () => {
    admin.getParticipant.mockResolvedValue({
      tracks: [],
      permission: new ParticipantPermission({
        canSubscribe: true,
        canPublishData: true,
        canPublish: false,
      }),
    });
    admin.updateParticipant.mockResolvedValue({ identity: 'u-1' });

    await service.setPublishSources('t_room', 'u-1', [TrackSource.MICROPHONE]);

    expect(admin.updateParticipant).toHaveBeenCalledWith('t_room', 'u-1', {
      permission: expect.objectContaining({
        canSubscribe: true,
        canPublishData: true,
        canPublish: true,
        canPublishSources: [TrackSource.MICROPHONE],
      }),
    });
  });

  it('takes publishing away entirely for an empty source list', async () => {
    admin.getParticipant.mockResolvedValue({
      tracks: [],
      permission: new ParticipantPermission({
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      }),
    });
    admin.updateParticipant.mockResolvedValue({ identity: 'u-1' });

    await service.setPublishSources('t_room', 'u-1', []);

    expect(admin.updateParticipant.mock.calls[0][2].permission).toMatchObject({
      canPublish: false,
      canPublishSources: [],
      canPublishData: true,
    });
  });

  it('answers null rather than throwing for someone not in the room', async () => {
    admin.getParticipant.mockRejectedValue(notFound());

    await expect(
      service.setPublishSources('t_room', 'ghost', []),
    ).resolves.toBeNull();
    await expect(
      service.muteSources('t_room', 'ghost', [TrackSource.MICROPHONE]),
    ).resolves.toBeNull();
    expect(admin.updateParticipant).not.toHaveBeenCalled();
  });

  it('mutes only the open tracks of the requested sources', async () => {
    admin.getParticipant.mockResolvedValue({
      tracks: [
        { sid: 'mic', source: TrackSource.MICROPHONE, muted: false },
        { sid: 'cam', source: TrackSource.CAMERA, muted: false },
        { sid: 'old', source: TrackSource.MICROPHONE, muted: true },
      ],
    });

    await expect(
      service.muteSources('t_room', 'u-1', [TrackSource.MICROPHONE]),
    ).resolves.toBe(1);
    expect(admin.mutePublishedTrack).toHaveBeenCalledTimes(1);
    expect(admin.mutePublishedTrack).toHaveBeenCalledWith(
      't_room',
      'u-1',
      'mic',
      true,
    );
  });

  it('lists nobody for a room LiveKit has not opened yet', async () => {
    admin.listParticipants.mockRejectedValue(
      new TwirpError('not_found', 'room', 404),
    );
    await expect(service.listParticipants('t_room')).resolves.toEqual([]);
  });

  it('does not swallow other LiveKit failures', async () => {
    admin.getParticipant.mockRejectedValue(
      new TwirpError('internal', 'boom', 500),
    );
    await expect(
      service.setPublishSources('t_room', 'u-1', []),
    ).rejects.toThrow('boom');
  });

  describe('join tokens', () => {
    const configured = new LivekitService({
      get: (key: string) =>
        ({
          LIVEKIT_API_KEY: 'devkey',
          LIVEKIT_API_SECRET: 'a-test-secret-that-is-long-enough',
          LIVEKIT_URL: 'ws://localhost:7880',
        })[key],
    } as never);
    const videoGrant = (token: string) =>
      JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
        .video;

    it('narrows publishing to the sources it names', async () => {
      const { token } = await configured.createJoinToken({
        room: 'r',
        identity: 'u-1',
        canPublish: true,
        publishSources: [TrackSource.MICROPHONE],
      });
      expect(videoGrant(token)).toMatchObject({
        canPublish: true,
        canPublishSources: ['microphone'],
      });
    });

    it('leaves every source open when none is named', async () => {
      const { token } = await configured.createJoinToken({
        room: 'r',
        identity: 'u-1',
      });
      expect(videoGrant(token).canPublishSources).toBeUndefined();
    });
  });
});
