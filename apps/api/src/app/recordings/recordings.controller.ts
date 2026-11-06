import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RecordingsService } from './recordings.service';

/**
 * Playback. Unguarded on purpose — a `<video src>` cannot send an API key, and
 * the signed, expiring link in the query string *is* the credential. The
 * platform decides who receives one.
 */
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Get(':id/file')
  async file(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    const { absolutePath } = await this.recordings.resolvePlayback(
      id,
      expires,
      signature,
    );
    // sendFile handles Range requests, which is what lets a student scrub
    // through a 90-minute class instead of downloading all of it first.
    res.type('video/mp4');
    res.sendFile(absolutePath);
  }
}
