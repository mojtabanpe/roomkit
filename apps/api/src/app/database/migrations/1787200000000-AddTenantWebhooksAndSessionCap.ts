import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantWebhooksAndSessionCap1787200000000
  implements MigrationInterface
{
  name = 'AddTenantWebhooksAndSessionCap1787200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Null on every existing tenant, which keeps the 30-minute default and
    // sends nobody webhooks — this migration changes no current behaviour.
    await queryRunner.query(
      'ALTER TABLE "tenants" ADD "maxSessionSeconds" integer',
    );
    await queryRunner.query(
      'ALTER TABLE "tenants" ADD "webhookUrl" character varying(500)',
    );
    await queryRunner.query(
      'ALTER TABLE "tenants" ADD "webhookSecret" character varying(100)',
    );

    await queryRunner.query(
      `CREATE TABLE "recordings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenantId" uuid NOT NULL,
        "slug" character varying(64) NOT NULL,
        "room" character varying(128) NOT NULL,
        "egressId" character varying(64) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'starting',
        "filePath" character varying(300),
        "durationSeconds" integer,
        "sizeBytes" bigint,
        "startedByIdentity" character varying(64),
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recordings" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      'CREATE INDEX "idx_recordings_tenant" ON "recordings" ("tenantId")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_recordings_room" ON "recordings" ("room")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "ux_recordings_egress" ON "recordings" ("egressId")',
    );
    await queryRunner.query(
      'ALTER TABLE "recordings" ADD CONSTRAINT "FK_recordings_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "recordings"');
    await queryRunner.query(
      'ALTER TABLE "tenants" DROP COLUMN "webhookSecret"',
    );
    await queryRunner.query('ALTER TABLE "tenants" DROP COLUMN "webhookUrl"');
    await queryRunner.query(
      'ALTER TABLE "tenants" DROP COLUMN "maxSessionSeconds"',
    );
  }
}
