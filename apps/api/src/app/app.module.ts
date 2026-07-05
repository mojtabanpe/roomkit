import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LivekitModule } from './livekit/livekit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Loads the repo-root .env so `nx serve api` picks up LiveKit creds.
      envFilePath: ['.env', '.env.local'],
    }),
    LivekitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
