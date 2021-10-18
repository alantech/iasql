import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, } from 'typeorm';

import { Region } from './region';

@Entity()
export class AWSCredentials {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  accessKeyId: string;

  @Column({
    unique: true,
  })
  secretAccessKey: string;

  // TODO remove and add multi region support by attaching region columns
  // to the various entities as appropriate
  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;
}
