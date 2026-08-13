import { roomOptionsFor } from './room.service';

describe('roomOptionsFor', () => {
  it('applies the camera capture and encoding ceiling returned by the API', () => {
    expect(
      roomOptionsFor({
        maxParticipants: 10,
        maxDurationSeconds: 1800,
        video: {
          width: 854,
          height: 480,
          frameRate: 24,
          maxBitrate: 700_000,
        },
      }),
    ).toMatchObject({
      videoCaptureDefaults: {
        resolution: { width: 854, height: 480, frameRate: 24 },
      },
      publishDefaults: {
        videoEncoding: { maxBitrate: 700_000, maxFramerate: 24 },
      },
    });
  });
});
