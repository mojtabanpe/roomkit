import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { LivekitModule } from './livekit/livekit.module';
import { MeetingsModule } from './meetings/meetings.module';
import { PlatformModule } from './platform/platform.module';
import { RoomsModule } from './rooms/rooms.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Loads the repo-root .env so `nx serve api` picks up LiveKit creds.
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    LivekitModule,
    MeetingsModule,
    RoomsModule,
    TenantsModule,
    UsageModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
