import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { AwsSecurityGroup, } from '../../aws_security_group@0.0.1/entity'

@Entity()
export class RDS {
  @PrimaryGeneratedColumn()
  id?: number;

  // TODO: add constraints
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#dbinstanceidentifier
  @Column({
    unique: true,
  })
  dbInstanceIdentifier: string;

  // TODO: Add constraints? range vary based on storage type and engine
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage
  @Column({
    type: 'int',
  })
  allocatedStorage: number;

  @Column()
  availabilityZone: string;

  // TODO: make this an entity eventually?
  // @ManyToOne(() => DBInstanceClass, { eager: true, })
  // @JoinColumn({
  //   name: 'db_instance_class_id',
  // })
  @Column()
  dbInstanceClass: string;

  @Column()
  engine: string;

  // ? How to handle this? It is used just for creation and if an update is needed. After creation / update the value is removed from db
  // TODO: Apply constraints?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masteruserpassword
  @Column({
    nullable: true,
  })
  masterUserPassword?: string;

  // TODO: Apply constraints?
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masterusername
  @Column({
    nullable: true,
  })
  masterUsername?: string;

  // TODO rename table
  @ManyToMany(() => AwsSecurityGroup)
  @JoinTable()
  vpcSecurityGroups: AwsSecurityGroup[];

  // TODO: make this an entity eventually?
  @Column({
    nullable: true,
  })
  endpointAddr?: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  endpointPort?: number;

  @Column({
    nullable: true,
  })
  endpointHostedZoneId?: string;
  
  @Column({
    type: 'int',
    default: 1,
  })
  backupRetentionPeriod: number;
}