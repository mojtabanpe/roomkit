import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1785658283780 implements MigrationInterface {
    name = 'InitialSchema1785658283780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "tenants" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "key" character varying(12) NOT NULL,
                "name" character varying(120) NOT NULL,
                "planMode" character varying(16) NOT NULL DEFAULT 'prepaid',
                "active" boolean NOT NULL DEFAULT true,
                "maxParticipants" integer,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_5c6e46bc16d5b24d9e1e040f11" ON "tenants" ("key")
        `);
        await queryRunner.query(`
            CREATE TABLE "api_keys" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid NOT NULL,
                "prefix" character varying(32) NOT NULL,
                "secretHash" character varying(64) NOT NULL,
                "label" character varying(80) NOT NULL DEFAULT 'default',
                "lastUsedAt" TIMESTAMP WITH TIME ZONE,
                "revokedAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_2cd545077d6e6e8378b051cf1b" ON "api_keys" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_6f6105c8efe05b310d046cbdb3" ON "api_keys" ("prefix")
        `);
        await queryRunner.query(`
            CREATE TABLE "meeting_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "roomSlug" character varying(128) NOT NULL,
                "identity" character varying(64) NOT NULL,
                "displayName" character varying(64) NOT NULL,
                "userId" uuid,
                "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "leftAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_b20c0fa5d983f544149da1e4495" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_00545c08914b549d7536efc731" ON "meeting_sessions" ("userId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_cf1e6996022b438eb76989406b" ON "meeting_sessions" ("roomSlug", "joinedAt")
        `);
        await queryRunner.query(`
            CREATE TABLE "messages" (
                "id" uuid NOT NULL,
                "roomSlug" character varying(128) NOT NULL,
                "senderIdentity" character varying(64) NOT NULL,
                "senderName" character varying(64) NOT NULL,
                "senderUserId" uuid,
                "body" text NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_cb25224b67993e2284dd8daad1" ON "messages" ("roomSlug", "createdAt")
        `);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(254) NOT NULL,
                "displayName" character varying(64) NOT NULL,
                "passwordHash" character varying(100) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")
        `);
        await queryRunner.query(`
            CREATE TABLE "rooms" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "slug" character varying(64) NOT NULL,
                "name" character varying(120) NOT NULL,
                "ownerId" uuid,
                "tenantId" uuid,
                "visibility" character varying(16) NOT NULL DEFAULT 'public',
                "passcodeHash" character varying(100),
                "maxParticipants" integer,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "ux_rooms_first_party_slug" ON "rooms" ("slug")
            WHERE "tenantId" IS NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "ux_rooms_tenant_slug" ON "rooms" ("tenantId", "slug")
        `);
        await queryRunner.query(`
            CREATE TABLE "tenant_balances" (
                "tenantId" uuid NOT NULL,
                "includedUnits" integer NOT NULL DEFAULT '0',
                "usedUnits" integer NOT NULL DEFAULT '0',
                "creditLimitUnits" integer NOT NULL DEFAULT '0',
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_b60d94f222348085afaf0b4cdd3" PRIMARY KEY ("tenantId")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "usage_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid,
                "room" character varying(128) NOT NULL,
                "identity" character varying(64) NOT NULL,
                "sourceSid" character varying(64) NOT NULL,
                "kind" character varying(16) NOT NULL DEFAULT 'participant',
                "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endedAt" TIMESTAMP WITH TIME ZONE,
                "units" integer NOT NULL DEFAULT '0',
                "billedUntil" TIMESTAMP WITH TIME ZONE NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_c9f17d50873fab2c46615f542bc" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a24d8f77ea257ebfb7e5a88027" ON "usage_events" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_94d3d610d618b8a9aae4f4f0ec" ON "usage_events" ("sourceSid")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_69de4ae302896a0f68807484b6" ON "usage_events" ("tenantId", "startedAt")
        `);
        await queryRunner.query(`
            ALTER TABLE "api_keys"
            ADD CONSTRAINT "FK_2cd545077d6e6e8378b051cf1b7" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms"
            ADD CONSTRAINT "FK_383ac461c63dd52c22ba73a6624" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms"
            ADD CONSTRAINT "FK_5229539ed865719b915542663d7" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "tenant_balances"
            ADD CONSTRAINT "FK_b60d94f222348085afaf0b4cdd3" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "tenant_balances" DROP CONSTRAINT "FK_b60d94f222348085afaf0b4cdd3"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" DROP CONSTRAINT "FK_5229539ed865719b915542663d7"
        `);
        await queryRunner.query(`
            ALTER TABLE "rooms" DROP CONSTRAINT "FK_383ac461c63dd52c22ba73a6624"
        `);
        await queryRunner.query(`
            ALTER TABLE "api_keys" DROP CONSTRAINT "FK_2cd545077d6e6e8378b051cf1b7"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_69de4ae302896a0f68807484b6"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_94d3d610d618b8a9aae4f4f0ec"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a24d8f77ea257ebfb7e5a88027"
        `);
        await queryRunner.query(`
            DROP TABLE "usage_events"
        `);
        await queryRunner.query(`
            DROP TABLE "tenant_balances"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ux_rooms_tenant_slug"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."ux_rooms_first_party_slug"
        `);
        await queryRunner.query(`
            DROP TABLE "rooms"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"
        `);
        await queryRunner.query(`
            DROP TABLE "users"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_cb25224b67993e2284dd8daad1"
        `);
        await queryRunner.query(`
            DROP TABLE "messages"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_cf1e6996022b438eb76989406b"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_00545c08914b549d7536efc731"
        `);
        await queryRunner.query(`
            DROP TABLE "meeting_sessions"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_6f6105c8efe05b310d046cbdb3"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_2cd545077d6e6e8378b051cf1b"
        `);
        await queryRunner.query(`
            DROP TABLE "api_keys"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_5c6e46bc16d5b24d9e1e040f11"
        `);
        await queryRunner.query(`
            DROP TABLE "tenants"
        `);
    }

}
