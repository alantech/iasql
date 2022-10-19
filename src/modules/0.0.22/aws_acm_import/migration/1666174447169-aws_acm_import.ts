import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsAcmImport1666174447169 implements MigrationInterface {
  name = 'awsAcmImport1666174447169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "certificate_import" ("id" SERIAL NOT NULL, "certificate" character varying NOT NULL, "private_key" character varying NOT NULL, "chain" character varying, "region" character varying NOT NULL DEFAULT default_aws_region(), CONSTRAINT "PK_8cbbdc4878246d11a36a5639a04" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "certificate_import" ADD CONSTRAINT "FK_c3ea56799d7f873cae4a90ac60c" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "certificate_import" DROP CONSTRAINT "FK_c3ea56799d7f873cae4a90ac60c"`,
    );
    await queryRunner.query(`DROP TABLE "certificate_import"`);
  }
}
