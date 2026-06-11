import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260610153103 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "magic_token" ("id" text not null, "token_hash" text not null, "email" text not null, "order_id" text null, "type" text check ("type" in ('order_view', 'login', 'activate')) not null, "expires_at" timestamptz not null, "used_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "magic_token_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_magic_token_deleted_at" ON "magic_token" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_magic_token_token_hash" ON "magic_token" ("token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_magic_token_email_type" ON "magic_token" ("email", "type") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "magic_token" cascade;`);
  }

}
