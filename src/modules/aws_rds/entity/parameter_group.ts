import { Column, Entity, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';

import { Parameter } from '@aws-sdk/client-rds';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Specifies the type of database engine
 * Enum generated executing the command
 * aws rds describe-db-engine-versions --query "DBEngineVersions[].DBParameterGroupFamily"
 */
export enum ParameterGroupFamily {
  AURORA_MYSQL5_7 = 'aurora-mysql5.7',
  AURORA_MYSQL8_0 = 'aurora-mysql8.0',
  DOCDB3_6 = 'docdb3.6',
  DOCDB4_0 = 'docdb4.0',
  CUSTOM_SQLSERVER_EE_15_0 = 'custom-sqlserver-ee-15.0',
  CUSTOM_SQLSERVER_SE_15_0 = 'custom-sqlserver-se-15.0',
  CUSTOM_SQLSERVER_WEB_15_0 = 'custom-sqlserver-web-15.0',
  NEPTUNE1 = 'neptune1',
  AURORA_POSTGRESQL10 = 'aurora-postgresql10',
  AURORA_POSTGRESQL11 = 'aurora-postgresql11',
  AURORA_POSTGRESQL12 = 'aurora-postgresql12',
  AURORA_POSTGRESQL13 = 'aurora-postgresql13',
  MARIADB10_2 = 'mariadb10.2',
  MARIADB10_3 = 'mariadb10.3',
  MARIADB10_4 = 'mariadb10.4',
  MARIADB10_5 = 'mariadb10.5',
  MARIADB10_6 = 'mariadb10.6',
  MYSQL5_7 = 'mysql5.7',
  MYSQL8_0 = 'mysql8.0',
  ORACLE_EE_19 = 'oracle-ee-19',
  ORACLE_EE_CDB_19 = 'oracle-ee-cdb-19',
  ORACLE_EE_CDB_21 = 'oracle-ee-cdb-21',
  ORACLE_SE2_19 = 'oracle-se2-19',
  ORACLE_SE2_CDB_19 = 'oracle-se2-cdb-19',
  ORACLE_SE2_CDB_21 = 'oracle-se2-cdb-21',
  AURORA5_6 = 'aurora5.6',
  POSTGRES10 = 'postgres10',
  POSTGRES11 = 'postgres11',
  POSTGRES12 = 'postgres12',
  POSTGRES13 = 'postgres13',
  POSTGRES14 = 'postgres14',
  SQLSERVER_EE_12_0 = 'sqlserver-ee-12.0',
  SQLSERVER_EE_13_0 = 'sqlserver-ee-13.0',
  SQLSERVER_EE_14_0 = 'sqlserver-ee-14.0',
  SQLSERVER_EE_15_0 = 'sqlserver-ee-15.0',
  SQLSERVER_EX_12_0 = 'sqlserver-ex-12.0',
  SQLSERVER_EX_13_0 = 'sqlserver-ex-13.0',
  SQLSERVER_EX_14_0 = 'sqlserver-ex-14.0',
  SQLSERVER_EX_15_0 = 'sqlserver-ex-15.0',
  SQLSERVER_SE_12_0 = 'sqlserver-se-12.0',
  SQLSERVER_SE_13_0 = 'sqlserver-se-13.0',
  SQLSERVER_SE_14_0 = 'sqlserver-se-14.0',
  SQLSERVER_SE_15_0 = 'sqlserver-se-15.0',
  SQLSERVER_WEB_12_0 = 'sqlserver-web-12.0',
  SQLSERVER_WEB_13_0 = 'sqlserver-web-13.0',
  SQLSERVER_WEB_14_0 = 'sqlserver-web-14.0',
  SQLSERVER_WEB_15_0 = 'sqlserver-web-15.0',
}

/**
 * Table to manage AWS RDS parameter groups. Database parameters specify how the database is configured.
 * For example, database parameters can specify the amount of resources, such as memory, to allocate to a database.
 *
 * A DB parameter group acts as a container for engine configuration values that are applied to one or more DB instances.
 *
 * @example
 * ```sql TheButton[Manage RDS parameter groups]="Manage RDS parameter groups"
 * INSERT INTO parameter_group (name, family, description) VALUES ('pg_name', 'postgres14', 'description');
 * SELECT params ->> 'ParameterValue' as value FROM parameter_group, jsonb_array_elements(parameters) as params
 * WHERE name = 'pg_name' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';
 *
 * DELETE FROM parameter_group WHERE name = 'pg_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-rds-integration.ts#L202
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html
 */
@Entity()
@Unique('paragrp_name_region', ['name', 'region'])
@Unique('paragrp_id_region', ['id', 'region']) // So the RDS entity can join on both
export class ParameterGroup {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the parameter group
   */
  @cloudId
  @Column()
  name: string;

  /**
   * @public
   * AWS ARN for the parameter group
   */
  @Column({
    unique: true,
    nullable: true,
  })
  arn?: string;

  /**
   * @public
   * Family for the parameter group
   */
  @Column({
    type: 'enum',
    enum: ParameterGroupFamily,
  })
  family: ParameterGroupFamily;

  /**
   * @public
   * Description for the parameter group
   */
  @Column()
  description: string;

  /**
   * @public
   * Complex type to represent the list of parameters for the group
   * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ParamValuesRef.html
   */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  parameters?: Parameter[];

  /**
   * @public
   * Region for the instance
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
