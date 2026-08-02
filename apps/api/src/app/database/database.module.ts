import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

export { ENTITIES };

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ENTITIES,
        migrations: MIGRATIONS,
        /**
         * Migrations own the schema now, in every environment. Leaving
         * `synchronize` on in development was what made `migration:generate`
         * useless there: TypeORM had already applied the entity changes, so
         * the generated migration came out empty and the two environments
         * drifted apart silently.
         *
         * `DB_SYNCHRONIZE=true` remains as a local escape hatch only. It and
         * migrations must not both be on — synchronize would create the tables
         * the initial migration then tries to create again.
         */
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        migrationsRun: config.get<string>('DB_SYNCHRONIZE') !== 'true',
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
