import {MigrationInterface, QueryRunner} from "typeorm";

export class awsEc21643082760075 implements MigrationInterface {
    name = 'awsEc21643082760075'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "boot_mode" ("id" SERIAL NOT NULL, "mode" character varying NOT NULL, CONSTRAINT "UQ_88a9fac6831af2d520a0947c113" UNIQUE ("mode"), CONSTRAINT "PK_114728d4fa02f297923c52ae1e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cpu_architecture" ("id" SERIAL NOT NULL, "cpu_architecture" character varying NOT NULL, CONSTRAINT "UQ_7a43b53cf9f82afd0f7a426fed9" UNIQUE ("cpu_architecture"), CONSTRAINT "PK_4374571b2fdb60c03e8876a5059" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "device_type" ("id" SERIAL NOT NULL, "device_type" character varying NOT NULL, CONSTRAINT "UQ_c49ce8ef8706f45c5650b2ed6ba" UNIQUE ("device_type"), CONSTRAINT "PK_f8d1c0daa8abde339c1056535a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."disk_info_disk_type_enum" AS ENUM('hdd', 'ssd')`);
        await queryRunner.query(`CREATE TABLE "disk_info" ("id" SERIAL NOT NULL, "size_in_gb" numeric NOT NULL, "count" integer NOT NULL, "disk_type" "public"."disk_info_disk_type_enum" NOT NULL, CONSTRAINT "PK_a145ea93c1809aa3ab0eaa8c0c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ebs_block_device_type_volume_type_enum" AS ENUM('gp2', 'gp3', 'io1', 'io2', 'sc1', 'st1', 'standard')`);
        await queryRunner.query(`CREATE TABLE "ebs_block_device_type" ("id" SERIAL NOT NULL, "delete_on_termination" boolean, "iops" integer, "snapshot_id" character varying, "volume_size" integer, "volume_type" "public"."ebs_block_device_type_volume_type_enum", "kms_key_id" character varying, "throughput" integer, "outpost_arn" character varying, "encrypted" boolean, CONSTRAINT "PK_0b63a25f83033ddd456af000a16" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ebs_block_device_mapping" ("id" SERIAL NOT NULL, "device_name" character varying, "virtual_name" character varying, "no_device" character varying, "ebs_block_device_type_id" integer, CONSTRAINT "PK_2fab1aa5f825fcde18dff90524b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ebs_optimized_info" ("id" SERIAL NOT NULL, "baseline_bandwidth_in_mbps" numeric NOT NULL, "baseline_throughput_in_m_bps" numeric NOT NULL, "baseline_iops" numeric NOT NULL, "maximum_bandwidth_in_mbps" numeric NOT NULL, "maximum_throughput_in_m_bps" numeric NOT NULL, "maximum_iops" numeric NOT NULL, CONSTRAINT "PK_b30c043be425c0015e97bc91c80" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."instance_storage_info_nvme_support_enum" AS ENUM('required', 'supported', 'unsupported')`);
        await queryRunner.query(`CREATE TABLE "instance_storage_info" ("id" SERIAL NOT NULL, "total_size_in_gb" numeric NOT NULL, "nvme_support" "public"."instance_storage_info_nvme_support_enum" NOT NULL, CONSTRAINT "PK_7a8c50e616d5415a68253bddf47" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."ebs_info_ebs_optimized_support_enum" AS ENUM('default', 'supported', 'unsupported')`);
        await queryRunner.query(`CREATE TYPE "public"."ebs_info_encryption_support_enum" AS ENUM('supported', 'unsupported')`);
        await queryRunner.query(`CREATE TYPE "public"."ebs_info_nvme_support_enum" AS ENUM('required', 'supported', 'unsupported')`);
        await queryRunner.query(`CREATE TABLE "ebs_info" ("id" SERIAL NOT NULL, "ebs_optimized_support" "public"."ebs_info_ebs_optimized_support_enum" NOT NULL, "encryption_support" "public"."ebs_info_encryption_support_enum" NOT NULL, "nvme_support" "public"."ebs_info_nvme_support_enum" NOT NULL, "ebs_optimized_info_id" integer, CONSTRAINT "PK_9012f4f7e784c479f53e0f195f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "efa_info" ("id" SERIAL NOT NULL, "maximum_efa_interfaces" integer NOT NULL, CONSTRAINT "PK_4f369baf517168abda55b75180d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fpga_device_memory_info" ("id" SERIAL NOT NULL, "size_in_mi_b" numeric NOT NULL, CONSTRAINT "PK_54bbcc5b13a900209e1e5ee1cf7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fpga_device_info" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "manufacturer" character varying NOT NULL, "count" integer NOT NULL, "fpga_device_memory_info_id" integer, CONSTRAINT "PK_6d50c7a37c3b72c0c9ff98b2369" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "fpga_info" ("id" SERIAL NOT NULL, "total_fpga_memory_in_mi_b" numeric NOT NULL, CONSTRAINT "PK_2d6188cbef48d727e6c3e9675c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gpu_device_memory_info" ("id" SERIAL NOT NULL, "size_in_mi_b" numeric NOT NULL, CONSTRAINT "PK_5832252cad6df9e5981ff55e6d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gpu_device_info" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "manufacturer" character varying NOT NULL, "count" integer NOT NULL, "gpu_device_memory_info_id" integer, CONSTRAINT "PK_900d565d2815aec5823dfc6d28c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "gpu_info" ("id" SERIAL NOT NULL, "total_gpu_memory_in_mi_b" numeric NOT NULL, CONSTRAINT "PK_b1f6c1b4319c4c09341f425dcf3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inference_device_info" ("id" SERIAL NOT NULL, "count" integer NOT NULL, "name" character varying NOT NULL, "manufacturer" character varying NOT NULL, CONSTRAINT "PK_fa829b22aa5feefb03fab5fbae9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inference_accelerator_info" ("id" SERIAL NOT NULL, CONSTRAINT "PK_67ef5a210c7303d30e4a5e14eae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "network_card_info" ("id" SERIAL NOT NULL, "network_card_index" integer NOT NULL, "network_performance" character varying NOT NULL, "maximum_network_interfaces" integer NOT NULL, CONSTRAINT "PK_5ba7818deb23194370050a59df1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."network_info_ena_support_enum" AS ENUM('required', 'supported', 'unsupported')`);
        await queryRunner.query(`CREATE TABLE "network_info" ("id" SERIAL NOT NULL, "network_performance" character varying NOT NULL, "maximum_network_interfaces" integer NOT NULL, "maximum_network_cards" integer NOT NULL, "default_network_card_index" integer NOT NULL, "ipv4_addresses_per_interface" integer NOT NULL, "ipv6_addresses_per_interface" integer NOT NULL, "ipv6_supported" boolean NOT NULL, "ena_support" "public"."network_info_ena_support_enum" NOT NULL, "efa_supported" boolean NOT NULL, "encryption_in_transit_supported" boolean NOT NULL, "efa_info_id" integer, CONSTRAINT "PK_81214b7c50e1372b56fa9db1139" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "placement_group_strategy" ("id" SERIAL NOT NULL, "strategy" character varying NOT NULL, CONSTRAINT "UQ_a34a971173d06144038dea8b028" UNIQUE ("strategy"), CONSTRAINT "PK_10966ef9356db3e3a9f95561603" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "placement_group_info" ("id" SERIAL NOT NULL, CONSTRAINT "PK_a01f2095ad16d54d185a1173790" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "processor_info" ("id" SERIAL NOT NULL, "sustained_clock_speed_in_g_hz" numeric, CONSTRAINT "PK_d49b0841d52bfff06c9556daf6a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usage_class" ("id" SERIAL NOT NULL, "usage_class" character varying NOT NULL, CONSTRAINT "UQ_330c813861b91da5119a46f4727" UNIQUE ("usage_class"), CONSTRAINT "PK_0c1f22f9333c84614dee14ec5b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "valid_core" ("id" SERIAL NOT NULL, "count" integer NOT NULL, CONSTRAINT "PK_0c78fcb17fc566b89f272a4ed30" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "valid_threads_per_core" ("id" SERIAL NOT NULL, "count" integer NOT NULL, CONSTRAINT "PK_51de13a0622b9a87423a7e9f242" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vcpu_info" ("id" SERIAL NOT NULL, "default_vcp_us" integer NOT NULL, "default_cores" integer NOT NULL, "default_threads_per_core" integer NOT NULL, CONSTRAINT "PK_124ca200f80f5ae0c9af443427a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "virtualization_type" ("id" SERIAL NOT NULL, "virtualization_type" character varying NOT NULL, CONSTRAINT "UQ_0d05e6087e782c5a437b40d8d2b" UNIQUE ("virtualization_type"), CONSTRAINT "PK_d798c8354c1647240be159f6f56" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."instance_type_hypervisor_enum" AS ENUM('nitro', 'xen')`);
        await queryRunner.query(`CREATE TABLE "instance_type" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "current_generation" boolean NOT NULL, "free_tier_eligible" boolean NOT NULL, "bare_metal" boolean NOT NULL, "hypervisor" "public"."instance_type_hypervisor_enum", "memory_size_in_mi_b" numeric NOT NULL, "instance_storage_supported" boolean NOT NULL, "hibernation_supported" boolean NOT NULL, "burstable_performance_supported" boolean NOT NULL, "dedicated_hosts_supported" boolean NOT NULL, "auto_recovery_supported" boolean NOT NULL, "processor_info_id" integer, "v_cpu_info_id" integer, "instance_storage_info_id" integer, "ebs_info_id" integer, "network_info_id" integer, "gpu_info_id" integer, "fpga_info_id" integer, "placement_group_info_id" integer, "inference_accelerator_info_id" integer, CONSTRAINT "PK_2ff067127c52f0f23049642883a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance" ("id" SERIAL NOT NULL, "instance_id" character varying, "ami" character varying NOT NULL, "instance_type_id" integer NOT NULL, CONSTRAINT "PK_eaf60e4a0c399c9935413e06474" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "product_code" ("id" SERIAL NOT NULL, "product_code_id" character varying, "product_code_type" character varying, CONSTRAINT "PK_6f2664014f87822b6a6b9ad1c95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "state_reason" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "message" character varying NOT NULL, CONSTRAINT "PK_09ff61ed06d22468a89038dea9b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "value" character varying NOT NULL, CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "instance_storage_info_disks_disk_info" ("instance_storage_info_id" integer NOT NULL, "disk_info_id" integer NOT NULL, CONSTRAINT "PK_29972402e9acbaeecc17e8380a5" PRIMARY KEY ("instance_storage_info_id", "disk_info_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_38834f60efde0aff7c836645a2" ON "instance_storage_info_disks_disk_info" ("instance_storage_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1be4a83d4a7526415a1e7faccc" ON "instance_storage_info_disks_disk_info" ("disk_info_id") `);
        await queryRunner.query(`CREATE TABLE "fpga_info_fpgas_fpga_device_info" ("fpga_info_id" integer NOT NULL, "fpga_device_info_id" integer NOT NULL, CONSTRAINT "PK_9fe7e4399fb8acbd894afdf7e8b" PRIMARY KEY ("fpga_info_id", "fpga_device_info_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_31655488bf79fd765281eb3ee1" ON "fpga_info_fpgas_fpga_device_info" ("fpga_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2268e105277f5229c9f188f61c" ON "fpga_info_fpgas_fpga_device_info" ("fpga_device_info_id") `);
        await queryRunner.query(`CREATE TABLE "gpu_info_gpus_gpu_device_info" ("gpu_info_id" integer NOT NULL, "gpu_device_info_id" integer NOT NULL, CONSTRAINT "PK_dcac6933105c6e6ae4b0b22325d" PRIMARY KEY ("gpu_info_id", "gpu_device_info_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bd125596702150cb617f381d0f" ON "gpu_info_gpus_gpu_device_info" ("gpu_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7a55525d1a014e05d9d4c8c52c" ON "gpu_info_gpus_gpu_device_info" ("gpu_device_info_id") `);
        await queryRunner.query(`CREATE TABLE "inference_accelerator_info_accelerators_inference_device_info" ("inference_accelerator_info_id" integer NOT NULL, "inference_device_info_id" integer NOT NULL, CONSTRAINT "PK_8200b5f36dcbde017733af34295" PRIMARY KEY ("inference_accelerator_info_id", "inference_device_info_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4f8487d0cd6197a3bbabaf669b" ON "inference_accelerator_info_accelerators_inference_device_info" ("inference_accelerator_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b602fa24ec14bdcc6ea5c5a8a6" ON "inference_accelerator_info_accelerators_inference_device_info" ("inference_device_info_id") `);
        await queryRunner.query(`CREATE TABLE "network_info_network_cards_network_card_info" ("network_info_id" integer NOT NULL, "network_card_info_id" integer NOT NULL, CONSTRAINT "PK_27b282b09a275b15db0ee632baa" PRIMARY KEY ("network_info_id", "network_card_info_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1cc52b6e3ae855a309660e58e6" ON "network_info_network_cards_network_card_info" ("network_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_733bc8883afdead96d888557d3" ON "network_info_network_cards_network_card_info" ("network_card_info_id") `);
        await queryRunner.query(`CREATE TABLE "pla_gro_inf_sup_str_pla_gro_str" ("placement_group_info_id" integer NOT NULL, "placement_group_strategy_id" integer NOT NULL, CONSTRAINT "PK_1b86686675e1421bfdb07d73b4e" PRIMARY KEY ("placement_group_info_id", "placement_group_strategy_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fcaa1b3100f75de6795abc2ff5" ON "pla_gro_inf_sup_str_pla_gro_str" ("placement_group_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5d67fa1330dd1981276ac4b8c" ON "pla_gro_inf_sup_str_pla_gro_str" ("placement_group_strategy_id") `);
        await queryRunner.query(`CREATE TABLE "processor_info_supported_architectures_cpu_architecture" ("processor_info_id" integer NOT NULL, "cpu_architecture_id" integer NOT NULL, CONSTRAINT "PK_d8640719bd3d211bbbdbba2178c" PRIMARY KEY ("processor_info_id", "cpu_architecture_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa37e93922c084e42c465a396e" ON "processor_info_supported_architectures_cpu_architecture" ("processor_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a31ab49cbc6b1730dfe3224017" ON "processor_info_supported_architectures_cpu_architecture" ("cpu_architecture_id") `);
        await queryRunner.query(`CREATE TABLE "vcpu_info_valid_cores_valid_core" ("vcpu_info_id" integer NOT NULL, "valid_core_id" integer NOT NULL, CONSTRAINT "PK_e88bd0682e432413ca4262e1348" PRIMARY KEY ("vcpu_info_id", "valid_core_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fc2c10994fe41dabc3a3b5a303" ON "vcpu_info_valid_cores_valid_core" ("vcpu_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3c86374d2d8408fce1e851e7fd" ON "vcpu_info_valid_cores_valid_core" ("valid_core_id") `);
        await queryRunner.query(`CREATE TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core" ("vcpu_info_id" integer NOT NULL, "valid_threads_per_core_id" integer NOT NULL, CONSTRAINT "PK_405060ff4bae839c3dda7919e45" PRIMARY KEY ("vcpu_info_id", "valid_threads_per_core_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_030e5f3fe8d268b47c57641506" ON "vcpu_info_valid_threads_per_core_valid_threads_per_core" ("vcpu_info_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_298b890565fa8e0a53b451738e" ON "vcpu_info_valid_threads_per_core_valid_threads_per_core" ("valid_threads_per_core_id") `);
        await queryRunner.query(`CREATE TABLE "instance_type_supported_usage_classes_usage_class" ("instance_type_id" integer NOT NULL, "usage_class_id" integer NOT NULL, CONSTRAINT "PK_d0810026a388f48b88ceb28c573" PRIMARY KEY ("instance_type_id", "usage_class_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f7d8375e34b43c1d490eef07b5" ON "instance_type_supported_usage_classes_usage_class" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f95cd9033d5c9c60f14e55d408" ON "instance_type_supported_usage_classes_usage_class" ("usage_class_id") `);
        await queryRunner.query(`CREATE TABLE "instance_type_supported_root_device_types_device_type" ("instance_type_id" integer NOT NULL, "device_type_id" integer NOT NULL, CONSTRAINT "PK_b5dd780fb09f81d26a07ea6ad98" PRIMARY KEY ("instance_type_id", "device_type_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5a146f5a523d027bdecf53f868" ON "instance_type_supported_root_device_types_device_type" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_58b6e3fd014da8bdf3e9fc688d" ON "instance_type_supported_root_device_types_device_type" ("device_type_id") `);
        await queryRunner.query(`CREATE TABLE "ins_typ_sup_vir_typ_vir_typ" ("instance_type_id" integer NOT NULL, "virtualization_type_id" integer NOT NULL, CONSTRAINT "PK_f0bc253acf504b2a1b4b47191ee" PRIMARY KEY ("instance_type_id", "virtualization_type_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0d163b978403b500b47eba5d09" ON "ins_typ_sup_vir_typ_vir_typ" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_66dce3dea1b1105585c7799796" ON "ins_typ_sup_vir_typ_vir_typ" ("virtualization_type_id") `);
        await queryRunner.query(`CREATE TABLE "instance_type_supported_boot_modes_boot_mode" ("instance_type_id" integer NOT NULL, "boot_mode_id" integer NOT NULL, CONSTRAINT "PK_c3f5ac38b4d96590a0e900b7f40" PRIMARY KEY ("instance_type_id", "boot_mode_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9c37dcb1e287c7a33b7faac34e" ON "instance_type_supported_boot_modes_boot_mode" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8feca90feb662840e93f69dbab" ON "instance_type_supported_boot_modes_boot_mode" ("boot_mode_id") `);
        await queryRunner.query(`CREATE TABLE "instance_type_regions_region" ("instance_type_id" integer NOT NULL, "region_id" integer NOT NULL, CONSTRAINT "PK_73c97905ad06b9cf2ef07bb3dc0" PRIMARY KEY ("instance_type_id", "region_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2ec996e8e52b74e2b833a0d15b" ON "instance_type_regions_region" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d2a09d2b55d7b6b89dc578db3" ON "instance_type_regions_region" ("region_id") `);
        await queryRunner.query(`CREATE TABLE "instance_type_availability_zones_availability_zone" ("instance_type_id" integer NOT NULL, "availability_zone_id" integer NOT NULL, CONSTRAINT "PK_fe1aab42aa0176751d17f54726c" PRIMARY KEY ("instance_type_id", "availability_zone_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bcc2197b46174377412f948c25" ON "instance_type_availability_zones_availability_zone" ("instance_type_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_412917c37df7b4fd87130c5b32" ON "instance_type_availability_zones_availability_zone" ("availability_zone_id") `);
        await queryRunner.query(`CREATE TABLE "instance_security_groups_aws_security_group" ("instance_id" integer NOT NULL, "aws_security_group_id" integer NOT NULL, CONSTRAINT "PK_80d249a863573caab7243ff1b07" PRIMARY KEY ("instance_id", "aws_security_group_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ee3dfb3bef7cf8a5123b107167" ON "instance_security_groups_aws_security_group" ("instance_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0bc4c00d7c86a81c48482a2773" ON "instance_security_groups_aws_security_group" ("aws_security_group_id") `);
        await queryRunner.query(`ALTER TABLE "ebs_block_device_mapping" ADD CONSTRAINT "FK_0fc2e484287ed69ded7dca5075f" FOREIGN KEY ("ebs_block_device_type_id") REFERENCES "ebs_block_device_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ebs_info" ADD CONSTRAINT "FK_c0d05e1ff186d9c4d26ed747d08" FOREIGN KEY ("ebs_optimized_info_id") REFERENCES "ebs_optimized_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fpga_device_info" ADD CONSTRAINT "FK_c83fc8695a42bc116e46db17bf6" FOREIGN KEY ("fpga_device_memory_info_id") REFERENCES "fpga_device_memory_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "gpu_device_info" ADD CONSTRAINT "FK_175d0ad17acc9c353077ba5d4e3" FOREIGN KEY ("gpu_device_memory_info_id") REFERENCES "gpu_device_memory_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "network_info" ADD CONSTRAINT "FK_5abc0ca3d03456246a6d1eacc84" FOREIGN KEY ("efa_info_id") REFERENCES "efa_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_837d9c5af92d3108647ba0f6190" FOREIGN KEY ("processor_info_id") REFERENCES "processor_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_a82e73fc00bf3488ee9d93055a7" FOREIGN KEY ("v_cpu_info_id") REFERENCES "vcpu_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_1867d2499134bd841f6dd932161" FOREIGN KEY ("instance_storage_info_id") REFERENCES "instance_storage_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_c74fd39985596ee10d03b405759" FOREIGN KEY ("ebs_info_id") REFERENCES "ebs_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_8a48290f7e48a213fe6b0931db6" FOREIGN KEY ("network_info_id") REFERENCES "network_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_7348bb6aba22093bf045157cb55" FOREIGN KEY ("gpu_info_id") REFERENCES "gpu_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_e9fd23c6b05997baa8f803f1c17" FOREIGN KEY ("fpga_info_id") REFERENCES "fpga_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_acadb5566239d7fdbeeb0919729" FOREIGN KEY ("placement_group_info_id") REFERENCES "placement_group_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_type" ADD CONSTRAINT "FK_b906f76dd0f0a7a4613bdf4f043" FOREIGN KEY ("inference_accelerator_info_id") REFERENCES "inference_accelerator_info"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance" ADD CONSTRAINT "FK_83592733879d33f177bb0a29ad6" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "instance_storage_info_disks_disk_info" ADD CONSTRAINT "FK_38834f60efde0aff7c836645a25" FOREIGN KEY ("instance_storage_info_id") REFERENCES "instance_storage_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_storage_info_disks_disk_info" ADD CONSTRAINT "FK_1be4a83d4a7526415a1e7facccf" FOREIGN KEY ("disk_info_id") REFERENCES "disk_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "fpga_info_fpgas_fpga_device_info" ADD CONSTRAINT "FK_31655488bf79fd765281eb3ee13" FOREIGN KEY ("fpga_info_id") REFERENCES "fpga_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "fpga_info_fpgas_fpga_device_info" ADD CONSTRAINT "FK_2268e105277f5229c9f188f61c2" FOREIGN KEY ("fpga_device_info_id") REFERENCES "fpga_device_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "gpu_info_gpus_gpu_device_info" ADD CONSTRAINT "FK_bd125596702150cb617f381d0f2" FOREIGN KEY ("gpu_info_id") REFERENCES "gpu_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "gpu_info_gpus_gpu_device_info" ADD CONSTRAINT "FK_7a55525d1a014e05d9d4c8c52c9" FOREIGN KEY ("gpu_device_info_id") REFERENCES "gpu_device_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "inference_accelerator_info_accelerators_inference_device_info" ADD CONSTRAINT "FK_4f8487d0cd6197a3bbabaf669b7" FOREIGN KEY ("inference_accelerator_info_id") REFERENCES "inference_accelerator_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "inference_accelerator_info_accelerators_inference_device_info" ADD CONSTRAINT "FK_b602fa24ec14bdcc6ea5c5a8a61" FOREIGN KEY ("inference_device_info_id") REFERENCES "inference_device_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "network_info_network_cards_network_card_info" ADD CONSTRAINT "FK_1cc52b6e3ae855a309660e58e60" FOREIGN KEY ("network_info_id") REFERENCES "network_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "network_info_network_cards_network_card_info" ADD CONSTRAINT "FK_733bc8883afdead96d888557d35" FOREIGN KEY ("network_card_info_id") REFERENCES "network_card_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "pla_gro_inf_sup_str_pla_gro_str" ADD CONSTRAINT "FK_fcaa1b3100f75de6795abc2ff57" FOREIGN KEY ("placement_group_info_id") REFERENCES "placement_group_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "pla_gro_inf_sup_str_pla_gro_str" ADD CONSTRAINT "FK_c5d67fa1330dd1981276ac4b8cf" FOREIGN KEY ("placement_group_strategy_id") REFERENCES "placement_group_strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "processor_info_supported_architectures_cpu_architecture" ADD CONSTRAINT "FK_aa37e93922c084e42c465a396e6" FOREIGN KEY ("processor_info_id") REFERENCES "processor_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "processor_info_supported_architectures_cpu_architecture" ADD CONSTRAINT "FK_a31ab49cbc6b1730dfe32240171" FOREIGN KEY ("cpu_architecture_id") REFERENCES "cpu_architecture"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_cores_valid_core" ADD CONSTRAINT "FK_fc2c10994fe41dabc3a3b5a303f" FOREIGN KEY ("vcpu_info_id") REFERENCES "vcpu_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_cores_valid_core" ADD CONSTRAINT "FK_3c86374d2d8408fce1e851e7fd8" FOREIGN KEY ("valid_core_id") REFERENCES "valid_core"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core" ADD CONSTRAINT "FK_030e5f3fe8d268b47c57641506a" FOREIGN KEY ("vcpu_info_id") REFERENCES "vcpu_info"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core" ADD CONSTRAINT "FK_298b890565fa8e0a53b451738e1" FOREIGN KEY ("valid_threads_per_core_id") REFERENCES "valid_threads_per_core"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_usage_classes_usage_class" ADD CONSTRAINT "FK_f7d8375e34b43c1d490eef07b55" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_usage_classes_usage_class" ADD CONSTRAINT "FK_f95cd9033d5c9c60f14e55d4085" FOREIGN KEY ("usage_class_id") REFERENCES "usage_class"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_root_device_types_device_type" ADD CONSTRAINT "FK_5a146f5a523d027bdecf53f8685" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_root_device_types_device_type" ADD CONSTRAINT "FK_58b6e3fd014da8bdf3e9fc688da" FOREIGN KEY ("device_type_id") REFERENCES "device_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ins_typ_sup_vir_typ_vir_typ" ADD CONSTRAINT "FK_0d163b978403b500b47eba5d097" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ins_typ_sup_vir_typ_vir_typ" ADD CONSTRAINT "FK_66dce3dea1b1105585c7799796f" FOREIGN KEY ("virtualization_type_id") REFERENCES "virtualization_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_boot_modes_boot_mode" ADD CONSTRAINT "FK_9c37dcb1e287c7a33b7faac34e8" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_boot_modes_boot_mode" ADD CONSTRAINT "FK_8feca90feb662840e93f69dbab0" FOREIGN KEY ("boot_mode_id") REFERENCES "boot_mode"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" ADD CONSTRAINT "FK_2ec996e8e52b74e2b833a0d15b2" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" ADD CONSTRAINT "FK_2d2a09d2b55d7b6b89dc578db39" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" ADD CONSTRAINT "FK_bcc2197b46174377412f948c251" FOREIGN KEY ("instance_type_id") REFERENCES "instance_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" ADD CONSTRAINT "FK_412917c37df7b4fd87130c5b328" FOREIGN KEY ("availability_zone_id") REFERENCES "availability_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" ADD CONSTRAINT "FK_ee3dfb3bef7cf8a5123b107167c" FOREIGN KEY ("instance_id") REFERENCES "instance"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" ADD CONSTRAINT "FK_0bc4c00d7c86a81c48482a2773d" FOREIGN KEY ("aws_security_group_id") REFERENCES "aws_security_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`
            create or replace procedure create_ec2_instance(_ami_id text, _instance_type text, _security_group_names text[])
            language plpgsql
            as $$
                declare
                    instance_type_id integer;
                    instance_id integer;
                    sg record;
                begin
                    select id into instance_type_id
                    from instance_type
                    where name = _instance_type;

                    insert into instance
                        (ami, instance_type_id)
                    values
                        (_ami_id, instance_type_id);
            
                    select id into instance_id
                    from instance
                    order by id desc
                    limit 1;

                    for sg in
                        select id
                        from aws_security_group
                        where group_name = any(_security_group_names)
                    loop
                        insert into
                            instance_security_groups_aws_security_group (instance_id, aws_security_group_id)
                        values
                            (instance_id, sg.id);
                    end loop;

                    raise info 'ec2_instance_id = %', instance_id;
                end;
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP procedure create_ec2_instance;`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" DROP CONSTRAINT "FK_0bc4c00d7c86a81c48482a2773d"`);
        await queryRunner.query(`ALTER TABLE "instance_security_groups_aws_security_group" DROP CONSTRAINT "FK_ee3dfb3bef7cf8a5123b107167c"`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" DROP CONSTRAINT "FK_412917c37df7b4fd87130c5b328"`);
        await queryRunner.query(`ALTER TABLE "instance_type_availability_zones_availability_zone" DROP CONSTRAINT "FK_bcc2197b46174377412f948c251"`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" DROP CONSTRAINT "FK_2d2a09d2b55d7b6b89dc578db39"`);
        await queryRunner.query(`ALTER TABLE "instance_type_regions_region" DROP CONSTRAINT "FK_2ec996e8e52b74e2b833a0d15b2"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_boot_modes_boot_mode" DROP CONSTRAINT "FK_8feca90feb662840e93f69dbab0"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_boot_modes_boot_mode" DROP CONSTRAINT "FK_9c37dcb1e287c7a33b7faac34e8"`);
        await queryRunner.query(`ALTER TABLE "ins_typ_sup_vir_typ_vir_typ" DROP CONSTRAINT "FK_66dce3dea1b1105585c7799796f"`);
        await queryRunner.query(`ALTER TABLE "ins_typ_sup_vir_typ_vir_typ" DROP CONSTRAINT "FK_0d163b978403b500b47eba5d097"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_root_device_types_device_type" DROP CONSTRAINT "FK_58b6e3fd014da8bdf3e9fc688da"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_root_device_types_device_type" DROP CONSTRAINT "FK_5a146f5a523d027bdecf53f8685"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_usage_classes_usage_class" DROP CONSTRAINT "FK_f95cd9033d5c9c60f14e55d4085"`);
        await queryRunner.query(`ALTER TABLE "instance_type_supported_usage_classes_usage_class" DROP CONSTRAINT "FK_f7d8375e34b43c1d490eef07b55"`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core" DROP CONSTRAINT "FK_298b890565fa8e0a53b451738e1"`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core" DROP CONSTRAINT "FK_030e5f3fe8d268b47c57641506a"`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_cores_valid_core" DROP CONSTRAINT "FK_3c86374d2d8408fce1e851e7fd8"`);
        await queryRunner.query(`ALTER TABLE "vcpu_info_valid_cores_valid_core" DROP CONSTRAINT "FK_fc2c10994fe41dabc3a3b5a303f"`);
        await queryRunner.query(`ALTER TABLE "processor_info_supported_architectures_cpu_architecture" DROP CONSTRAINT "FK_a31ab49cbc6b1730dfe32240171"`);
        await queryRunner.query(`ALTER TABLE "processor_info_supported_architectures_cpu_architecture" DROP CONSTRAINT "FK_aa37e93922c084e42c465a396e6"`);
        await queryRunner.query(`ALTER TABLE "pla_gro_inf_sup_str_pla_gro_str" DROP CONSTRAINT "FK_c5d67fa1330dd1981276ac4b8cf"`);
        await queryRunner.query(`ALTER TABLE "pla_gro_inf_sup_str_pla_gro_str" DROP CONSTRAINT "FK_fcaa1b3100f75de6795abc2ff57"`);
        await queryRunner.query(`ALTER TABLE "network_info_network_cards_network_card_info" DROP CONSTRAINT "FK_733bc8883afdead96d888557d35"`);
        await queryRunner.query(`ALTER TABLE "network_info_network_cards_network_card_info" DROP CONSTRAINT "FK_1cc52b6e3ae855a309660e58e60"`);
        await queryRunner.query(`ALTER TABLE "inference_accelerator_info_accelerators_inference_device_info" DROP CONSTRAINT "FK_b602fa24ec14bdcc6ea5c5a8a61"`);
        await queryRunner.query(`ALTER TABLE "inference_accelerator_info_accelerators_inference_device_info" DROP CONSTRAINT "FK_4f8487d0cd6197a3bbabaf669b7"`);
        await queryRunner.query(`ALTER TABLE "gpu_info_gpus_gpu_device_info" DROP CONSTRAINT "FK_7a55525d1a014e05d9d4c8c52c9"`);
        await queryRunner.query(`ALTER TABLE "gpu_info_gpus_gpu_device_info" DROP CONSTRAINT "FK_bd125596702150cb617f381d0f2"`);
        await queryRunner.query(`ALTER TABLE "fpga_info_fpgas_fpga_device_info" DROP CONSTRAINT "FK_2268e105277f5229c9f188f61c2"`);
        await queryRunner.query(`ALTER TABLE "fpga_info_fpgas_fpga_device_info" DROP CONSTRAINT "FK_31655488bf79fd765281eb3ee13"`);
        await queryRunner.query(`ALTER TABLE "instance_storage_info_disks_disk_info" DROP CONSTRAINT "FK_1be4a83d4a7526415a1e7facccf"`);
        await queryRunner.query(`ALTER TABLE "instance_storage_info_disks_disk_info" DROP CONSTRAINT "FK_38834f60efde0aff7c836645a25"`);
        await queryRunner.query(`ALTER TABLE "instance" DROP CONSTRAINT "FK_83592733879d33f177bb0a29ad6"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_b906f76dd0f0a7a4613bdf4f043"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_acadb5566239d7fdbeeb0919729"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_e9fd23c6b05997baa8f803f1c17"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_7348bb6aba22093bf045157cb55"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_8a48290f7e48a213fe6b0931db6"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_c74fd39985596ee10d03b405759"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_1867d2499134bd841f6dd932161"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_a82e73fc00bf3488ee9d93055a7"`);
        await queryRunner.query(`ALTER TABLE "instance_type" DROP CONSTRAINT "FK_837d9c5af92d3108647ba0f6190"`);
        await queryRunner.query(`ALTER TABLE "network_info" DROP CONSTRAINT "FK_5abc0ca3d03456246a6d1eacc84"`);
        await queryRunner.query(`ALTER TABLE "gpu_device_info" DROP CONSTRAINT "FK_175d0ad17acc9c353077ba5d4e3"`);
        await queryRunner.query(`ALTER TABLE "fpga_device_info" DROP CONSTRAINT "FK_c83fc8695a42bc116e46db17bf6"`);
        await queryRunner.query(`ALTER TABLE "ebs_info" DROP CONSTRAINT "FK_c0d05e1ff186d9c4d26ed747d08"`);
        await queryRunner.query(`ALTER TABLE "ebs_block_device_mapping" DROP CONSTRAINT "FK_0fc2e484287ed69ded7dca5075f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0bc4c00d7c86a81c48482a2773"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee3dfb3bef7cf8a5123b107167"`);
        await queryRunner.query(`DROP TABLE "instance_security_groups_aws_security_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_412917c37df7b4fd87130c5b32"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bcc2197b46174377412f948c25"`);
        await queryRunner.query(`DROP TABLE "instance_type_availability_zones_availability_zone"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d2a09d2b55d7b6b89dc578db3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ec996e8e52b74e2b833a0d15b"`);
        await queryRunner.query(`DROP TABLE "instance_type_regions_region"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8feca90feb662840e93f69dbab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c37dcb1e287c7a33b7faac34e"`);
        await queryRunner.query(`DROP TABLE "instance_type_supported_boot_modes_boot_mode"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66dce3dea1b1105585c7799796"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d163b978403b500b47eba5d09"`);
        await queryRunner.query(`DROP TABLE "ins_typ_sup_vir_typ_vir_typ"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58b6e3fd014da8bdf3e9fc688d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a146f5a523d027bdecf53f868"`);
        await queryRunner.query(`DROP TABLE "instance_type_supported_root_device_types_device_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f95cd9033d5c9c60f14e55d408"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7d8375e34b43c1d490eef07b5"`);
        await queryRunner.query(`DROP TABLE "instance_type_supported_usage_classes_usage_class"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_298b890565fa8e0a53b451738e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_030e5f3fe8d268b47c57641506"`);
        await queryRunner.query(`DROP TABLE "vcpu_info_valid_threads_per_core_valid_threads_per_core"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3c86374d2d8408fce1e851e7fd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc2c10994fe41dabc3a3b5a303"`);
        await queryRunner.query(`DROP TABLE "vcpu_info_valid_cores_valid_core"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a31ab49cbc6b1730dfe3224017"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa37e93922c084e42c465a396e"`);
        await queryRunner.query(`DROP TABLE "processor_info_supported_architectures_cpu_architecture"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5d67fa1330dd1981276ac4b8c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fcaa1b3100f75de6795abc2ff5"`);
        await queryRunner.query(`DROP TABLE "pla_gro_inf_sup_str_pla_gro_str"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_733bc8883afdead96d888557d3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1cc52b6e3ae855a309660e58e6"`);
        await queryRunner.query(`DROP TABLE "network_info_network_cards_network_card_info"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b602fa24ec14bdcc6ea5c5a8a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f8487d0cd6197a3bbabaf669b"`);
        await queryRunner.query(`DROP TABLE "inference_accelerator_info_accelerators_inference_device_info"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a55525d1a014e05d9d4c8c52c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd125596702150cb617f381d0f"`);
        await queryRunner.query(`DROP TABLE "gpu_info_gpus_gpu_device_info"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2268e105277f5229c9f188f61c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31655488bf79fd765281eb3ee1"`);
        await queryRunner.query(`DROP TABLE "fpga_info_fpgas_fpga_device_info"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1be4a83d4a7526415a1e7faccc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38834f60efde0aff7c836645a2"`);
        await queryRunner.query(`DROP TABLE "instance_storage_info_disks_disk_info"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`DROP TABLE "state_reason"`);
        await queryRunner.query(`DROP TABLE "product_code"`);
        await queryRunner.query(`DROP TABLE "instance"`);
        await queryRunner.query(`DROP TABLE "instance_type"`);
        await queryRunner.query(`DROP TYPE "public"."instance_type_hypervisor_enum"`);
        await queryRunner.query(`DROP TABLE "virtualization_type"`);
        await queryRunner.query(`DROP TABLE "vcpu_info"`);
        await queryRunner.query(`DROP TABLE "valid_threads_per_core"`);
        await queryRunner.query(`DROP TABLE "valid_core"`);
        await queryRunner.query(`DROP TABLE "usage_class"`);
        await queryRunner.query(`DROP TABLE "processor_info"`);
        await queryRunner.query(`DROP TABLE "placement_group_info"`);
        await queryRunner.query(`DROP TABLE "placement_group_strategy"`);
        await queryRunner.query(`DROP TABLE "network_info"`);
        await queryRunner.query(`DROP TYPE "public"."network_info_ena_support_enum"`);
        await queryRunner.query(`DROP TABLE "network_card_info"`);
        await queryRunner.query(`DROP TABLE "inference_accelerator_info"`);
        await queryRunner.query(`DROP TABLE "inference_device_info"`);
        await queryRunner.query(`DROP TABLE "gpu_info"`);
        await queryRunner.query(`DROP TABLE "gpu_device_info"`);
        await queryRunner.query(`DROP TABLE "gpu_device_memory_info"`);
        await queryRunner.query(`DROP TABLE "fpga_info"`);
        await queryRunner.query(`DROP TABLE "fpga_device_info"`);
        await queryRunner.query(`DROP TABLE "fpga_device_memory_info"`);
        await queryRunner.query(`DROP TABLE "efa_info"`);
        await queryRunner.query(`DROP TABLE "ebs_info"`);
        await queryRunner.query(`DROP TYPE "public"."ebs_info_nvme_support_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ebs_info_encryption_support_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ebs_info_ebs_optimized_support_enum"`);
        await queryRunner.query(`DROP TABLE "instance_storage_info"`);
        await queryRunner.query(`DROP TYPE "public"."instance_storage_info_nvme_support_enum"`);
        await queryRunner.query(`DROP TABLE "ebs_optimized_info"`);
        await queryRunner.query(`DROP TABLE "ebs_block_device_mapping"`);
        await queryRunner.query(`DROP TABLE "ebs_block_device_type"`);
        await queryRunner.query(`DROP TYPE "public"."ebs_block_device_type_volume_type_enum"`);
        await queryRunner.query(`DROP TABLE "disk_info"`);
        await queryRunner.query(`DROP TYPE "public"."disk_info_disk_type_enum"`);
        await queryRunner.query(`DROP TABLE "device_type"`);
        await queryRunner.query(`DROP TABLE "cpu_architecture"`);
        await queryRunner.query(`DROP TABLE "boot_mode"`);
    }

}
