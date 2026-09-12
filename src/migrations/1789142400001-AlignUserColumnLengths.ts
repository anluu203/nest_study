import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignUserColumnLengths1789142400001 implements MigrationInterface {
  name = 'AlignUserColumnLengths1789142400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying(320)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "username" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying`,
    );
  }
}
