import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260610172818 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "magic_token" add column if not exists "payload" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "magic_token" drop column if exists "payload";`);
  }

}
