import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsSecretsManager1668095913103 implements MigrationInterface {
  name = 'awsSecretsManager1668095913103';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "secret" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "value" character varying, "version_id" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_6afa4961954e17ec2d6401afc3d" PRIMARY KEY ("id"))`,
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
