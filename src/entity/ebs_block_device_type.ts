import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

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
  id: number;

  @Column()
  deleteOnTermination: boolean;

  @Column({
    type: 'int',
  })
  iops: number;

  @Column()
  snapshotId: string;

  @Column({
    type: 'int',
  })
  volumeSize: number;

  @Column({
    type: 'enum',
    enum: EBSBlockDeviceVolumeType,
  })
  volumeType: EBSBlockDeviceVolumeType;

  @Column()
  kmsKeyId: string;

  @Column({
    type: 'int',
  })
  throughput: number;

  @Column()
  outpostArn: string;

  @Column()
  encrypted: boolean;
}
