import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260612095936 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seventeen_track_number" drop constraint if exists "seventeen_track_number_tracking_number_unique";`);
    this.addSql(`create table if not exists "seventeen_track_number" ("id" text not null, "tracking_number" text not null, "fulfillment_id" text not null, "order_id" text not null, "display_id" integer null, "carrier" integer null, "last_status" text null, "registered_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seventeen_track_number_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seventeen_track_number_tracking_number_unique" ON "seventeen_track_number" ("tracking_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seventeen_track_number_deleted_at" ON "seventeen_track_number" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seventeen_track_number" cascade;`);
  }

}
