import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSecretsManager1666175378522 implements MigrationInterface {
  name = 'awsSecretsManager1666175378522';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "secret" ("name" character varying NOT NULL, "description" character varying, "value" character varying, "version_id" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_f05861f3e072021bda08543eb4c" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "secret" ADD CONSTRAINT "FK_df5b10b7a61df5b76a27f968ee2" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "secret" DROP CONSTRAINT "FK_df5b10b7a61df5b76a27f968ee2"`);
    await queryRunner.query(`DROP TABLE "secret"`);
  }
}
