import {MigrationInterface, QueryRunner} from "typeorm";

export class updateRds1633702933269 implements MigrationInterface {
    name = 'updateRds1633702933269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "character_set" ("id" SERIAL NOT NULL, "character_set_name" character varying NOT NULL, "character_set_description" character varying, CONSTRAINT "UQ_bd3acc10c6e3e46d395dbd62f38" UNIQUE ("character_set_name"), CONSTRAINT "PK_c8e16ff898530271ff50d765911" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exportable_log_type" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, CONSTRAINT "UQ_8a722b68144f86254288cbf849b" UNIQUE ("type"), CONSTRAINT "PK_b7ac936668c10ffe2d81ecc490c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "feature_name" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_d9dfdaf97be65a71234a1e151aa" UNIQUE ("name"), CONSTRAINT "PK_5370835a735374d9d2d3e442281" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "supported_engine_mode" ("id" SERIAL NOT NULL, "mode" character varying NOT NULL, CONSTRAINT "UQ_195226533f376ca48d7f23d0e26" UNIQUE ("mode"), CONSTRAINT "PK_5f6ac090ecf0f92d5a6dcc73e0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "timezone" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "UQ_416ff1a8aedc587a4b907606f1c" UNIQUE ("name"), CONSTRAINT "PK_2706edc3223dd1d219f9f6a11b1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "upgrade_target" ("id" SERIAL NOT NULL, "description" character varying, "auto_upgrade" boolean, "is_major_version_upgrade" boolean, "supports_parallel_query" boolean, "supports_global_databases" boolean, "engine_version_id" integer, CONSTRAINT "PK_f9be5fc5d0f96f9c2cfebeb3c40" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "engine_version" ("id" SERIAL NOT NULL, "engine" character varying NOT NULL, "engine_version" character varying NOT NULL, "db_parameter_group_family" character varying NOT NULL, "db_engine_description" character varying NOT NULL, "db_engine_version_description" character varying NOT NULL, "supports_log_exports_to_cloudwatch_logs" boolean NOT NULL, "supports_read_replica" boolean NOT NULL, "status" character varying NOT NULL, "supports_parallel_query" boolean NOT NULL, "supports_global_databases" boolean NOT NULL, "character_set_id" integer, CONSTRAINT "UQ_ed96cab69ec37aed3821a4425c7" UNIQUE ("engine_version"), CONSTRAINT "PK_78ce275dc827b0733a45c79d6a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "upgrade_target_supported_engine_modes_supported_engine_mode" ("upgrade_target_id" integer NOT NULL, "supported_engine_mode_id" integer NOT NULL, CONSTRAINT "PK_d84ae331737da89ef03ad5e18a5" PRIMARY KEY ("upgrade_target_id", "supported_engine_mode_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8d9873989625cd727e2849357e" ON "upgrade_target_supported_engine_modes_supported_engine_mode" ("upgrade_target_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5eb731c791fd72e2159a82ff94" ON "upgrade_target_supported_engine_modes_supported_engine_mode" ("supported_engine_mode_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_valid_upgrade_targets_upgrade_target" ("engine_version_id" integer NOT NULL, "upgrade_target_id" integer NOT NULL, CONSTRAINT "PK_d023ecc41c465d76b0af52f16ca" PRIMARY KEY ("engine_version_id", "upgrade_target_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0b9d53fadcfc2b156c0578e26a" ON "engine_version_valid_upgrade_targets_upgrade_target" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f6eada6a897f57e03afdca8b4" ON "engine_version_valid_upgrade_targets_upgrade_target" ("upgrade_target_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_exportable_log_types_exportable_log_type" ("engine_version_id" integer NOT NULL, "exportable_log_type_id" integer NOT NULL, CONSTRAINT "PK_115e1f1629c8f9c750065fb7690" PRIMARY KEY ("engine_version_id", "exportable_log_type_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_213878cf8b7fe21a798590901e" ON "engine_version_exportable_log_types_exportable_log_type" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_20d6999924d3689ce9c6feba0b" ON "engine_version_exportable_log_types_exportable_log_type" ("exportable_log_type_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_supported_engine_modes_supported_engine_mode" ("engine_version_id" integer NOT NULL, "supported_engine_mode_id" integer NOT NULL, CONSTRAINT "PK_516df2eba438f65ec8309fa994b" PRIMARY KEY ("engine_version_id", "supported_engine_mode_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5219b2e9e7239aedab4c0efd88" ON "engine_version_supported_engine_modes_supported_engine_mode" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bf981feb7226ab1eea1f8137e9" ON "engine_version_supported_engine_modes_supported_engine_mode" ("supported_engine_mode_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_supported_character_sets_character_set" ("engine_version_id" integer NOT NULL, "character_set_id" integer NOT NULL, CONSTRAINT "PK_752f008f747621e83a72c53d361" PRIMARY KEY ("engine_version_id", "character_set_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c75893914eaa6b126d86ea1107" ON "engine_version_supported_character_sets_character_set" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_40ee09086af8e73dfb789cf4ae" ON "engine_version_supported_character_sets_character_set" ("character_set_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_supported_nchar_character_sets_character_set" ("engine_version_id" integer NOT NULL, "character_set_id" integer NOT NULL, CONSTRAINT "PK_05e88ddba1d2942a3975a3e01dc" PRIMARY KEY ("engine_version_id", "character_set_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3fe9d74aca258c5be138cbd318" ON "engine_version_supported_nchar_character_sets_character_set" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ddb19763885c9409cdd63e1201" ON "engine_version_supported_nchar_character_sets_character_set" ("character_set_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_supported_feature_names_feature_name" ("engine_version_id" integer NOT NULL, "feature_name_id" integer NOT NULL, CONSTRAINT "PK_f22a8b668488008f63e8307739b" PRIMARY KEY ("engine_version_id", "feature_name_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b21e21f9cc5b3912ceb61ac99" ON "engine_version_supported_feature_names_feature_name" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6143d3a09a41fa2dd555631ff" ON "engine_version_supported_feature_names_feature_name" ("feature_name_id") `);
        await queryRunner.query(`CREATE TABLE "engine_version_supported_timezones_timezone" ("engine_version_id" integer NOT NULL, "timezone_id" integer NOT NULL, CONSTRAINT "PK_043b9488caca8ab35ae33713bd3" PRIMARY KEY ("engine_version_id", "timezone_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5e596e02a6f9cae013ef16ccb0" ON "engine_version_supported_timezones_timezone" ("engine_version_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8bf722a82544147511e5f305d0" ON "engine_version_supported_timezones_timezone" ("timezone_id") `);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "engine"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "engine_version"`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "engine_version_id" integer`);
        await queryRunner.query(`ALTER TABLE "upgrade_target" ADD CONSTRAINT "FK_f72e551ae46bb42c1b7d5c0c958" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rds" ADD CONSTRAINT "FK_f0c9a8ba920bd21d2f2833e1d92" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "engine_version" ADD CONSTRAINT "FK_87600ab5ee44e3d1d2c7bb01083" FOREIGN KEY ("character_set_id") REFERENCES "character_set"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "upgrade_target_supported_engine_modes_supported_engine_mode" ADD CONSTRAINT "FK_8d9873989625cd727e2849357e6" FOREIGN KEY ("upgrade_target_id") REFERENCES "upgrade_target"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "upgrade_target_supported_engine_modes_supported_engine_mode" ADD CONSTRAINT "FK_5eb731c791fd72e2159a82ff948" FOREIGN KEY ("supported_engine_mode_id") REFERENCES "supported_engine_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_valid_upgrade_targets_upgrade_target" ADD CONSTRAINT "FK_0b9d53fadcfc2b156c0578e26ab" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_valid_upgrade_targets_upgrade_target" ADD CONSTRAINT "FK_3f6eada6a897f57e03afdca8b49" FOREIGN KEY ("upgrade_target_id") REFERENCES "upgrade_target"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_exportable_log_types_exportable_log_type" ADD CONSTRAINT "FK_213878cf8b7fe21a798590901e6" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_exportable_log_types_exportable_log_type" ADD CONSTRAINT "FK_20d6999924d3689ce9c6feba0bb" FOREIGN KEY ("exportable_log_type_id") REFERENCES "exportable_log_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_engine_modes_supported_engine_mode" ADD CONSTRAINT "FK_5219b2e9e7239aedab4c0efd880" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_engine_modes_supported_engine_mode" ADD CONSTRAINT "FK_bf981feb7226ab1eea1f8137e93" FOREIGN KEY ("supported_engine_mode_id") REFERENCES "supported_engine_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_character_sets_character_set" ADD CONSTRAINT "FK_c75893914eaa6b126d86ea1107c" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_character_sets_character_set" ADD CONSTRAINT "FK_40ee09086af8e73dfb789cf4aea" FOREIGN KEY ("character_set_id") REFERENCES "character_set"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_nchar_character_sets_character_set" ADD CONSTRAINT "FK_3fe9d74aca258c5be138cbd318c" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_nchar_character_sets_character_set" ADD CONSTRAINT "FK_ddb19763885c9409cdd63e12013" FOREIGN KEY ("character_set_id") REFERENCES "character_set"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_feature_names_feature_name" ADD CONSTRAINT "FK_9b21e21f9cc5b3912ceb61ac999" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_feature_names_feature_name" ADD CONSTRAINT "FK_d6143d3a09a41fa2dd555631ffc" FOREIGN KEY ("feature_name_id") REFERENCES "feature_name"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_timezones_timezone" ADD CONSTRAINT "FK_5e596e02a6f9cae013ef16ccb03" FOREIGN KEY ("engine_version_id") REFERENCES "engine_version"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_timezones_timezone" ADD CONSTRAINT "FK_8bf722a82544147511e5f305d0f" FOREIGN KEY ("timezone_id") REFERENCES "timezone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "engine_version_supported_timezones_timezone" DROP CONSTRAINT "FK_8bf722a82544147511e5f305d0f"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_timezones_timezone" DROP CONSTRAINT "FK_5e596e02a6f9cae013ef16ccb03"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_feature_names_feature_name" DROP CONSTRAINT "FK_d6143d3a09a41fa2dd555631ffc"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_feature_names_feature_name" DROP CONSTRAINT "FK_9b21e21f9cc5b3912ceb61ac999"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_nchar_character_sets_character_set" DROP CONSTRAINT "FK_ddb19763885c9409cdd63e12013"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_nchar_character_sets_character_set" DROP CONSTRAINT "FK_3fe9d74aca258c5be138cbd318c"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_character_sets_character_set" DROP CONSTRAINT "FK_40ee09086af8e73dfb789cf4aea"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_character_sets_character_set" DROP CONSTRAINT "FK_c75893914eaa6b126d86ea1107c"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_engine_modes_supported_engine_mode" DROP CONSTRAINT "FK_bf981feb7226ab1eea1f8137e93"`);
        await queryRunner.query(`ALTER TABLE "engine_version_supported_engine_modes_supported_engine_mode" DROP CONSTRAINT "FK_5219b2e9e7239aedab4c0efd880"`);
        await queryRunner.query(`ALTER TABLE "engine_version_exportable_log_types_exportable_log_type" DROP CONSTRAINT "FK_20d6999924d3689ce9c6feba0bb"`);
        await queryRunner.query(`ALTER TABLE "engine_version_exportable_log_types_exportable_log_type" DROP CONSTRAINT "FK_213878cf8b7fe21a798590901e6"`);
        await queryRunner.query(`ALTER TABLE "engine_version_valid_upgrade_targets_upgrade_target" DROP CONSTRAINT "FK_3f6eada6a897f57e03afdca8b49"`);
        await queryRunner.query(`ALTER TABLE "engine_version_valid_upgrade_targets_upgrade_target" DROP CONSTRAINT "FK_0b9d53fadcfc2b156c0578e26ab"`);
        await queryRunner.query(`ALTER TABLE "upgrade_target_supported_engine_modes_supported_engine_mode" DROP CONSTRAINT "FK_5eb731c791fd72e2159a82ff948"`);
        await queryRunner.query(`ALTER TABLE "upgrade_target_supported_engine_modes_supported_engine_mode" DROP CONSTRAINT "FK_8d9873989625cd727e2849357e6"`);
        await queryRunner.query(`ALTER TABLE "engine_version" DROP CONSTRAINT "FK_87600ab5ee44e3d1d2c7bb01083"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP CONSTRAINT "FK_f0c9a8ba920bd21d2f2833e1d92"`);
        await queryRunner.query(`ALTER TABLE "upgrade_target" DROP CONSTRAINT "FK_f72e551ae46bb42c1b7d5c0c958"`);
        await queryRunner.query(`ALTER TABLE "rds" DROP COLUMN "engine_version_id"`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "engine_version" character varying`);
        await queryRunner.query(`ALTER TABLE "rds" ADD "engine" character varying NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8bf722a82544147511e5f305d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e596e02a6f9cae013ef16ccb0"`);
        await queryRunner.query(`DROP TABLE "engine_version_supported_timezones_timezone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6143d3a09a41fa2dd555631ff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b21e21f9cc5b3912ceb61ac99"`);
        await queryRunner.query(`DROP TABLE "engine_version_supported_feature_names_feature_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddb19763885c9409cdd63e1201"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3fe9d74aca258c5be138cbd318"`);
        await queryRunner.query(`DROP TABLE "engine_version_supported_nchar_character_sets_character_set"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40ee09086af8e73dfb789cf4ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c75893914eaa6b126d86ea1107"`);
        await queryRunner.query(`DROP TABLE "engine_version_supported_character_sets_character_set"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf981feb7226ab1eea1f8137e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5219b2e9e7239aedab4c0efd88"`);
        await queryRunner.query(`DROP TABLE "engine_version_supported_engine_modes_supported_engine_mode"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_20d6999924d3689ce9c6feba0b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_213878cf8b7fe21a798590901e"`);
        await queryRunner.query(`DROP TABLE "engine_version_exportable_log_types_exportable_log_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f6eada6a897f57e03afdca8b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b9d53fadcfc2b156c0578e26a"`);
        await queryRunner.query(`DROP TABLE "engine_version_valid_upgrade_targets_upgrade_target"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5eb731c791fd72e2159a82ff94"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8d9873989625cd727e2849357e"`);
        await queryRunner.query(`DROP TABLE "upgrade_target_supported_engine_modes_supported_engine_mode"`);
        await queryRunner.query(`DROP TABLE "engine_version"`);
        await queryRunner.query(`DROP TABLE "upgrade_target"`);
        await queryRunner.query(`DROP TABLE "timezone"`);
        await queryRunner.query(`DROP TABLE "supported_engine_mode"`);
        await queryRunner.query(`DROP TABLE "feature_name"`);
        await queryRunner.query(`DROP TABLE "exportable_log_type"`);
        await queryRunner.query(`DROP TABLE "character_set"`);
    }

}
