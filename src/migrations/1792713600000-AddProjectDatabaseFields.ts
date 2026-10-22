import { MigrationInterface, QueryRunner } from 'typeorm';
import { categorySlug } from '../core/utils/category-slug';

export class AddProjectDatabaseFields1792713600000
  implements MigrationInterface
{
  name = 'AddProjectDatabaseFields1792713600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '10s'`);
    await queryRunner.query(`ALTER TABLE "user"
      ADD "fullName" varchar(200), ADD "phone" varchar(30), ADD "address" text`);

    await queryRunner.query(`ALTER TABLE "categories" ADD "slug" varchar(255)`);
    const categories = (await queryRunner.query(
      `SELECT "id", "name" FROM "categories"`,
    )) as { id: string; name: string }[];
    for (const category of categories) {
      await queryRunner.query(
        `UPDATE "categories" SET "slug" = $1 WHERE "id" = $2`,
        [categorySlug(category.name, category.id), category.id],
      );
    }
    await queryRunner.query(`ALTER TABLE "categories"
      ALTER "slug" SET NOT NULL, ADD CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")`);

    await queryRunner.query(`ALTER TABLE "products"
      ADD "sku" varchar(100), ADD "brand" varchar(100), ADD "discountPrice" bigint,
      ADD "stockQuantity" integer, ADD "images" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD "warrantyMonths" integer, ADD "specifications" jsonb,
      ADD CONSTRAINT "UQ_products_sku" UNIQUE ("sku"),
      ADD CONSTRAINT "CHK_products_discount" CHECK ("discountPrice" >= 0 AND "discountPrice" <= "price"),
      ADD CONSTRAINT "CHK_products_stock" CHECK ("stockQuantity" >= 0),
      ADD CONSTRAINT "CHK_products_warranty" CHECK ("warrantyMonths" >= 0),
      ADD CONSTRAINT "CHK_products_images_array" CHECK (jsonb_typeof("images") = 'array'),
      ADD CONSTRAINT "CHK_products_specs_object" CHECK (jsonb_typeof("specifications") = 'object')`);
    await queryRunner.query(`UPDATE "products" SET "images" = jsonb_build_array("imageUrl")
      WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> ''`);

    await queryRunner.query(`ALTER TABLE "orders"
      ADD "orderCode" varchar(39), ADD "shippingName" varchar(200),
      ADD "shippingPhone" varchar(30), ADD "shippingAddress" text, ADD "paymentMethod" varchar(20),
      ADD CONSTRAINT "CHK_orders_payment_method" CHECK ("paymentMethod" IN ('COD', 'VNPAY'))`);
    await queryRunner.query(
      `UPDATE "orders" SET "orderCode" = 'DH-' || "id"::text`,
    );
    await queryRunner.query(`ALTER TABLE "orders"
      ALTER "orderCode" SET NOT NULL,
      ALTER "orderCode" SET DEFAULT ('DH-' || uuid_generate_v4()::text),
      ADD CONSTRAINT "UQ_orders_code" UNIQUE ("orderCode")`);

    await queryRunner.query(`CREATE TABLE "reviews" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" text,
      "userId" uuid NOT NULL, "productId" uuid NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5),
      CONSTRAINT "FK_reviews_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_reviews_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(
      `CREATE TYPE "warranty_status_enum" AS ENUM ('RECEIVED', 'CHECKING', 'REPAIRING', 'COMPLETED')`,
    );
    await queryRunner.query(`CREATE TABLE "warranty_tickets" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "ticketCode" varchar(39) NOT NULL DEFAULT ('BH-' || uuid_generate_v4()::text),
      "productId" uuid NOT NULL, "userId" uuid, "orderCode" varchar(39), "serialNumber" varchar(200),
      "contactName" varchar(200) NOT NULL, "contactPhone" varchar(30) NOT NULL,
      "issueDescription" text NOT NULL, "techNotes" text,
      "status" "warranty_status_enum" NOT NULL DEFAULT 'RECEIVED',
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_warranty_tickets" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_warranty_ticket_code" UNIQUE ("ticketCode"),
      CONSTRAINT "FK_warranty_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_warranty_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_warranty_order" FOREIGN KEY ("orderCode") REFERENCES "orders"("orderCode") ON DELETE RESTRICT ON UPDATE RESTRICT
    )`);
    await queryRunner.query(`CREATE TABLE "product_recommendations" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productName" varchar(200) NOT NULL,
      "categoryType" varchar(50) NOT NULL, "referencePrice" bigint NOT NULL,
      "targetUses" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "keySpecs" jsonb NOT NULL DEFAULT '{}'::jsonb, "reasoningMap" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "isVisible" boolean NOT NULL DEFAULT true, "productId" uuid,
      "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_product_recommendations" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_recommendations_price" CHECK ("referencePrice" >= 0),
      CONSTRAINT "CHK_recommendations_uses" CHECK (jsonb_typeof("targetUses") = 'array' AND "targetUses" <@ '["OFFICE","GAMING","DESIGN"]'::jsonb),
      CONSTRAINT "CHK_recommendations_specs" CHECK (jsonb_typeof("keySpecs") = 'object'),
      CONSTRAINT "CHK_recommendations_reasoning" CHECK (jsonb_typeof("reasoningMap") = 'object'),
      CONSTRAINT "FK_recommendations_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
    )`);
    for (const [table, index, columns] of [
      ['reviews', 'IDX_reviews_user', '"userId"'],
      ['reviews', 'IDX_reviews_product', '"productId"'],
      ['warranty_tickets', 'IDX_warranty_product', '"productId"'],
      ['warranty_tickets', 'IDX_warranty_user', '"userId"'],
      ['warranty_tickets', 'IDX_warranty_order', '"orderCode"'],
      ['product_recommendations', 'IDX_recommendations_product', '"productId"'],
      [
        'product_recommendations',
        'IDX_recommendations_visible_category',
        '"isVisible", "categoryType"',
      ],
    ]) {
      await queryRunner.query(
        `CREATE INDEX "${index}" ON "${table}" (${columns})`,
      );
    }
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'This migration preserves historical data and cannot be automatically reverted. Restore the verified backup or write a forward migration.',
      ),
    );
  }
}
