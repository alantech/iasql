import { Runtime, PackageType, Architecture, } from '@aws-sdk/client-lambda';
import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { cloudId } from '../../../../services/cloud-id';

import { Role } from '../../aws_iam/entity';

@Entity()
export class LambdaFunction {
  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({
    default: '1',
  })
  version?: string;

  @Column({ nullable: true, })
  description?: string;

  @Column({ nullable: true, })
  zipB64?: string;

  @ManyToOne(() => Role, role => role.roleName, { eager: true, })
  @JoinColumn({
    name: 'role_name',
  })
  role: Role;

  // Handler is required if the deployment package is a .zip file archive
  @Column({ nullable: true, })
  handler?: string;

  @Column({
    type: 'enum',
    enum: Runtime,
    nullable: true,
  })
  runtime?: Runtime;

  @Column({
    type: 'enum',
    enum: PackageType,
  })
  packageType: PackageType;

  @Column({
    enum: Architecture,
    nullable: true,
    type: 'array',
  })
  architectures?: Architecture[];

  @Column({
    type: 'int',
    nullable: true,
  })
  memorySize?: number;

  @Column({
    type: 'json',
    nullable: true,
  })
  environment?: { [key: string]: string }
  
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string }

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