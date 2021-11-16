import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

export enum EBSBlockDeviceVolumeType {
  GP2 = 'gp2',
  GP3 = 'gp3',
  IO1 = 'io1',
  IO2 = 'io2',
  SC1 = 'sc1',
  ST1 = 'st1',
  STANDARD = 'standard',
}

@Entity()
export class EBSBlockDeviceType {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  deleteOnTermination?: boolean;

  @Column({
    type: 'int',
    nullable: true,
  })
  iops?: number;

  @Column({
    nullable: true,
  })
  snapshotId?: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  volumeSize?: number;

  @Column({
    type: 'enum',
    enum: EBSBlockDeviceVolumeType,
    nullable: true,
  })
  volumeType?: EBSBlockDeviceVolumeType;

  @Column({
    nullable: true,
  })
  kmsKeyId?: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  throughput?: number;

  @Column({
    nullable: true,
  })
  outpostArn?: string;

  @Column({
    nullable: true,
  })
  encrypted?: boolean;
}
