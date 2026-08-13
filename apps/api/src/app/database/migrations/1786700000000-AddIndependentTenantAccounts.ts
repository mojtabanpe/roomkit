import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndependentTenantAccounts1786700000000 implements MigrationInterface {
  name = 'AddIndependentTenantAccounts1786700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD "username" character varying(32)',
    );
    await queryRunner.query(
      `UPDATE "users" SET "username" = 'user_' || substring(replace("id"::text, '-', '') from 1 for 12)`,
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "ux_users_username" ON "users" ("username")',
    );

    await queryRunner.query(
      'ALTER TABLE "tenants" ADD "email" character varying(254)',
    );
    await queryRunner.query(
      'ALTER TABLE "tenants" ADD "passwordHash" character varying(100)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "ux_tenants_email" ON "tenants" ("email") WHERE "email" IS NOT NULL',
    );

    await queryRunner.query(
      `ALTER TABLE "tenant_members" ADD "status" character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_members" ADD "source" character varying(16) NOT NULL DEFAULT 'tenant'`,
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_members" ADD "respondedAt" TIMESTAMP WITH TIME ZONE',
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_tenant_members_active_user" ON "tenant_members" ("userId") WHERE "status" = 'active'`,
    );

    await queryRunner.query(
      'CREATE TABLE "tenant_room_members" ("roomId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_tenant_room_members" PRIMARY KEY ("roomId", "userId"))',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_tenant_room_members_user" ON "tenant_room_members" ("userId")',
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_room_members" ADD CONSTRAINT "FK_tenant_room_members_room" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_room_members" ADD CONSTRAINT "FK_tenant_room_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tenant_room_members"');
    await queryRunner.query(
      'DROP INDEX "public"."ux_tenant_members_active_user"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_members" DROP COLUMN "respondedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_members" DROP COLUMN "source"',
    );
    await queryRunner.query(
      'ALTER TABLE "tenant_members" DROP COLUMN "status"',
    );
    await queryRunner.query('DROP INDEX "public"."ux_tenants_email"');
    await queryRunner.query('ALTER TABLE "tenants" DROP COLUMN "passwordHash"');
    await queryRunner.query('ALTER TABLE "tenants" DROP COLUMN "email"');
    await queryRunner.query('DROP INDEX "public"."ux_users_username"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "username"');
  }
}
