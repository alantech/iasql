import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { cloudId, } from '../../../../services/cloud-id'
import { Instance, } from '../../aws_ec2/entity';

export enum Architecture {
  ARM64 = "arm64",
  I386 = "i386",
  X86_64 = "x86_64",
  X86_64_MAC = "x86_64_mac",
}

export enum RootDeviceType {
  EBS = "ebs",
  INSTANCE_STORE = "instance-store",
}

@Entity()
export class InstanceMetadata {
  // same id as the `instance` table
  @Column()
  @OneToOne(() => Instance, {
    // deleting a row from the `instance` table deletes the corresponding row here
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id'
  })
  id?: number;

  @PrimaryColumn()
  @cloudId
  instanceId: string;

  @Column({
    type: 'enum',
    enum: Architecture,
  })
  architecture: Architecture;

  @Column({
    type: 'cidr',
  })
  privateIpAddress: string;

  @Column({
    type: 'timestamptz',
  })
  launchTime: Date;

  @Column({
    type: 'int',
  })
  cpuCores: number;

  @Column({
    type: 'int',
  })
  memSizeMB: number;

  @Column({
    type: 'boolean',
  })
  ebsOptimized: boolean;

  @Column({
    type: 'enum',
    enum: RootDeviceType,
  })
  rootDeviceType: RootDeviceType;

  @Column({
    nullable: true,
  })
  rootDeviceName?: string;
}