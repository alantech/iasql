import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Types of tables supported by Dynamo DB
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.TableClasses.html
 */
export enum TableClass {
  Standard = 'STANDARD',
  StandardInfrequentAccess = 'STANDARD_INFREQUENT_ACCESS',
}

/**
 * Table to manage AWS Dynamo DB tables. Amazon DynamoDB is a fully managed, serverless, key-value
 * NoSQL database designed to run high-performance applications at any scale. DynamoDB offers built-in security,
 * continuous backups, automated multi-Region replication, in-memory caching, and data import and export tools.
 *
 * @example
 * ```sql TheButton[Manage a DynamoDB table]="Manage a DynamoDB table"
 * INSERT INTO dynamo_table (table_name, table_class, throughput, primary_key)
 * VALUES ('dynamo-table', 'STANDARD','"PAY_PER_REQUEST"', '{"key": "S", "val": "S"}');
 *
 * SELECT * FROM dynamo_table  WHERE table_name = 'dynamo-table';
 *
 * DELETE FROM dynamo_table WHERE table_name = 'dynamo-table';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-dynamo-integration.ts#L90
 * @see https://aws.amazon.com/dynamodb/
 *
 */
@Entity()
export class DynamoTable {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the Dynamo table
   */
  @Column({
    /* unique: true, */ // Waiting on Postgres 15 to revive this
    nullable: false,
  })
  @cloudId
  tableName: string;

  /**
   * @public
   * Class for the table
   */
  @Column({
    type: 'enum',
    nullable: false,
    enum: TableClass,
  })
  tableClass: TableClass;

  /**
   * @public
   * Complex type to represent the provisioned throughput settings for the table
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ProvisionedThroughput.html
   *
   * @privateRemarks
   * TODO: How to constrain this more appropriately in the database?
   */

  @Column({
    type: 'json',
    nullable: false,
  })
  throughput: 'PAY_PER_REQUEST' | { ReadCapacityUnits: number; WriteCapacityUnits: number };

  /**
   * @public
   * Internal AWS ID for the table
   */
  @Column({
    /* unique: true, */ // Waiting on Postgres 15 to revive this
    nullable: true,
  })
  tableId?: string;

  /**
   * @public
   * Complex type to define the primary key for the table
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html#HowItWorks.CoreComponents.PrimaryKey
   *
   * @privateRemarks
   * TODO: How to constrain this more appropriately in the database?
   * https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
   * This was really hard to find to figure out the correct strings to shove in here
   * TODO2: How to constrain to just two keys?
   */
  @Column({
    type: 'json',
    nullable: false,
  })
  primaryKey: { [key: string]: 'B' | 'BOOL' | 'BS' | 'L' | 'M' | 'N' | 'NS' | 'NULL' | 'S' | 'SS' };

  /**
   * @public
   * Creation time
   */
  @Column({
    type: 'timestamp without time zone',
    nullable: true,
  })
  createdAt?: Date;

  /**
   * @public
   * Region for the Codedeploy deployment group
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

  // TODO: Add encryption support, local secondary keys, stream support, global support,
  //       global secondary indexes, and tags
}
