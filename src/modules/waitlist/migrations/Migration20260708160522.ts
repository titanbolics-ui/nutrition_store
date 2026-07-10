import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260708160522 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "waitlist" ("id" text not null, "product_id" text not null, "variant_id" text not null, "email" text not null, "marketing_consent" boolean not null, "resend_contact_id" text null, "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "waitlist_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_waitlist_deleted_at" ON "waitlist" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_waitlist_email_variant_id_unique" ON "waitlist" ("email", "variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_waitlist_variant_id" ON "waitlist" ("variant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "waitlist" cascade;`);
  }

}
