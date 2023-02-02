import { MigrationInterface, QueryRunner } from 'typeorm';

export class awsCodepipeline1675104381410 implements MigrationInterface {
  name = 'awsCodepipeline1675104381410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pipeline_declaration" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "artifact_store" json NOT NULL, "stages" json, "region" character varying NOT NULL DEFAULT default_aws_region(), "service_role_name" character varying, CONSTRAINT "uq_pipeline_name_region" UNIQUE ("name", "region"), CONSTRAINT "PK_93c54842c962c7c37ac07f06124" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "pipeline_declaration" ADD CONSTRAINT "FK_d791d1a394429e36cfe2a1cf851" FOREIGN KEY ("service_role_name") REFERENCES "iam_role"("role_name") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pipeline_declaration" ADD CONSTRAINT "FK_506c5e054eaa62fa0d8ba201533" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pipeline_declaration" DROP CONSTRAINT "FK_506c5e054eaa62fa0d8ba201533"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pipeline_declaration" DROP CONSTRAINT "FK_d791d1a394429e36cfe2a1cf851"`,
    );
    await queryRunner.query(`DROP TABLE "pipeline_declaration"`);
  }
}
