import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { ENTITIES } from './app/database/entities';
import { MIGRATIONS } from './app/database/migrations';

// Only the TypeORM CLI uses this file. The running app builds its DataSource
// through `DatabaseModule` instead, from @nestjs/config.
config({ path: ['.env', '.env.local'] });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ENTITIES,
  migrations: MIGRATIONS,
});
