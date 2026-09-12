import { MigrationInterface, QueryRunner } from 'typeorm';

export class EcommerceCore1789142400000 implements MigrationInterface {
  name = 'EcommerceCore1789142400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM ('USER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "order_status_enum" AS ENUM ('AddingItem', 'Processing', 'Preparing', 'Shipping', 'Done')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" RENAME COLUMN "userName" TO "username"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying(320)`,
    );
    await queryRunner.query(`UPDATE "user" SET "email" = LOWER("email")`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "role" "user_role_enum" NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_email" UNIQUE ("email")`,
    );

    await queryRunner.query(
      `CREATE TABLE "category_parents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_category_parents_name" UNIQUE ("name"), CONSTRAINT "PK_category_parents" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "description" text, "parentId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_categories" PRIMARY KEY ("id"), CONSTRAINT "UQ_categories_parent_name" UNIQUE ("parentId", "name"), CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parentId") REFERENCES "category_parents"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(200) NOT NULL, "description" text, "imageUrl" character varying, "price" bigint NOT NULL, "categoryId" uuid NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_products" PRIMARY KEY ("id"), CONSTRAINT "CHK_products_price_positive" CHECK ("price" > 0), CONSTRAINT "FK_products_category" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_category_active" ON "products" ("categoryId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "status" "order_status_enum" NOT NULL DEFAULT 'AddingItem', "totalPrice" bigint NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_orders" PRIMARY KEY ("id"), CONSTRAINT "CHK_orders_total_nonnegative" CHECK ("totalPrice" >= 0), CONSTRAINT "FK_orders_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_user_status_created" ON "orders" ("userId", "status", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_orders_active_cart" ON "orders" ("userId") WHERE "status" = 'AddingItem'`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" bigint NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_order_items" PRIMARY KEY ("id"), CONSTRAINT "UQ_order_items_order_product" UNIQUE ("orderId", "productId"), CONSTRAINT "CHK_order_items_quantity_positive" CHECK ("quantity" > 0), CONSTRAINT "CHK_order_items_price_nonnegative" CHECK ("unitPrice" >= 0), CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE, CONSTRAINT "FK_order_items_product" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_order" ON "order_items" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_product" ON "order_items" ("productId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "UQ_orders_active_cart"`);
    await queryRunner.query(`DROP INDEX "IDX_orders_user_status_created"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP INDEX "IDX_products_category_active"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "category_parents"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_user_email"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "role"`);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" RENAME COLUMN "username" TO "userName"`,
    );
    await queryRunner.query(`DROP TYPE "order_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
