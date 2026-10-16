import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrls1792108800000 implements MigrationInterface {
  name = 'AddImageUrls1792108800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "avatarUrl" character varying(2048)`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "imageUrl" character varying(2048)`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_parents" ADD "imageUrl" character varying(2048)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_parents" DROP COLUMN "imageUrl"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatarUrl"`);
  }
}
