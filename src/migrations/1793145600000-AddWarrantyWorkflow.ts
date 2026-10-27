import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarrantyWorkflow1793145600000 implements MigrationInterface {
  name = 'AddWarrantyWorkflow1793145600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '10s'`);
    await queryRunner.query(`CREATE TABLE "warranty_products" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderItemId" uuid NOT NULL,
      "unitNumber" integer NOT NULL, "serialNumber" varchar(200),
      "purchasedAt" date NOT NULL, "warrantyMonths" integer, "expiresAt" date,
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_warranty_products" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_warranty_products_unit" UNIQUE ("orderItemId", "unitNumber"),
      CONSTRAINT "UQ_warranty_products_serial" UNIQUE ("serialNumber"),
      CONSTRAINT "CHK_warranty_products_unit" CHECK ("unitNumber" > 0),
      CONSTRAINT "CHK_warranty_products_months" CHECK ("warrantyMonths" >= 0),
      CONSTRAINT "CHK_warranty_products_dates" CHECK ("expiresAt" >= "purchasedAt"),
      CONSTRAINT "FK_warranty_products_item" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`ALTER TABLE "warranty_tickets" ADD "warrantyProductId" uuid,
      ADD CONSTRAINT "FK_warranty_ticket_unit" FOREIGN KEY ("warrantyProductId") REFERENCES "warranty_products"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_warranty_active_unit" ON "warranty_tickets" ("warrantyProductId")
      WHERE "warrantyProductId" IS NOT NULL AND "status" <> 'COMPLETED'`);
    await queryRunner.query(`CREATE TABLE "warranty_events" (
      "id" SERIAL NOT NULL, "ticketId" uuid NOT NULL, "status" "warranty_status_enum" NOT NULL,
      "note" text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_warranty_events" PRIMARY KEY ("id"),
      CONSTRAINT "FK_warranty_events_ticket" FOREIGN KEY ("ticketId") REFERENCES "warranty_tickets"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_warranty_events_ticket_date" ON "warranty_events" ("ticketId", "createdAt")`,
    );
    // Preserve known legacy state without inventing past transition dates or purchase dates.
    await queryRunner.query(`INSERT INTO "warranty_events" ("ticketId", "status", "note", "createdAt")
      SELECT "id", "status", COALESCE(NULLIF("techNotes", ''), 'Trạng thái được lưu trước khi triển khai lịch sử bảo hành.'), "updatedAt"
      FROM "warranty_tickets"`);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Warranty workflow contains purchase records and processing history and cannot be automatically reverted. Restore a verified backup instead.',
      ),
    );
  }
}
