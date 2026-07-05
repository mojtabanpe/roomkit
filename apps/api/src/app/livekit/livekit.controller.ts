import { Body, Controller, Post } from '@nestjs/common';
import { JoinTokenDto } from './dto/join-token.dto';
import { JoinTokenResponse, LivekitService } from './livekit.service';

@Controller('livekit')
export class LivekitController {
  constructor(private readonly livekit: LivekitService) {}

  /**
   * Issue a join token for a participant. The frontend calls this before
   * connecting to the LiveKit room.
   */
  @Post('token')
  async token(@Body() dto: JoinTokenDto): Promise<JoinTokenResponse> {
    return this.livekit.createJoinToken(dto);
  }
}
