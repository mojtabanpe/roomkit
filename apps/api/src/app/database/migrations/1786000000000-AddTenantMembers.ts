import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantMembers1786000000000 implements MigrationInterface {
  name = 'AddTenantMembers1786000000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "tenant_members" ("tenantId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_tenant_members" PRIMARY KEY ("tenantId", "userId"))');
    await queryRunner.query('CREATE INDEX "IDX_tenant_members_user" ON "tenant_members" ("userId")');
    await queryRunner.query('ALTER TABLE "tenant_members" ADD CONSTRAINT "FK_tenant_members_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE');
    await queryRunner.query('ALTER TABLE "tenant_members" ADD CONSTRAINT "FK_tenant_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tenant_members"');
  }
}
