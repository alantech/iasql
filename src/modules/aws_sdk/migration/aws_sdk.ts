import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSdk implements MigrationInterface {
  // dummy migration
  name = 'awsSdk';

  public async up(queryRunner: QueryRunner): Promise<void> {}

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
