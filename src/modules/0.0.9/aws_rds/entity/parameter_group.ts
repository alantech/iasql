import { Parameter } from '@aws-sdk/client-rds';
import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

// Enum generated executing the command
// aws rds describe-db-engine-versions --query "DBEngineVersions[].DBParameterGroupFamily"
// generating a set, and then replacing '-' and '.' with '_' for the keys.
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
  SQLSERVER_WEB_15_0 = 'sqlserver-web-15.0'
}

@Entity()
export class ParameterGroup {

  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({
    unique: true,
    nullable: true,
  })
  arn?: string;

  @Column({
    type: 'enum',
    enum: ParameterGroupFamily,
  })
  family: ParameterGroupFamily;

  @Column()
  description: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  parameters?: Parameter[];

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}