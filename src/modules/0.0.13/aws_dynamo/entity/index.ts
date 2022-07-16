import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'


import { cloudId, } from '../../../../services/cloud-id'

export enum TableClass {
  Standard = 'STANDARD',
  StandardInfrequentAccess = 'STANDARD_INFREQUENT_ACCESS',
}

@Entity()
export class DynamoTable {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    /* unique: true, */ // Waiting on Postgres 15 to revive this
    nullable: false,
  })
  @cloudId
  tableName: string;

  @Column({
    type: 'enum',
    nullable: false,
    enum: TableClass,
  })
  tableClass: TableClass;

  // TODO: How to constrain this more appropriately in the database?
  @Column({
    type: 'json',
    nullable: false,
  })
  throughput: 'PAY_PER_REQUEST' | { ReadCapacityUnits: number, WriteCapacityUnits: number, };

  @Column({
    /* unique: true, */ // Waiting on Postgres 15 to revive this
    nullable: true,
  })
  tableId?: string;

  // TODO: How to constrain this more appropriately in the database?
  // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  // This was really hard to find to figure out the correct strings to shove in here
  // TODO2: How to constrain to just two keys?
  @Column({
    type: 'json',
  })
  primaryKey: { [key: string]: 'B' | 'BOOL' | 'BS' | 'L' | 'M' | 'N' | 'NS' | 'NULL' | 'S' | 'SS', };

  @Column({
    type: 'timestamp without time zone',
    nullable: true,
  })
  createdAt?: Date;

  // TODO: Add encryption support, local secondary keys, stream support, global support,
  //       global secondary indexes, and tags
}