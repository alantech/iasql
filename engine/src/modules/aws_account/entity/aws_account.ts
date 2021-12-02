import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, } from 'typeorm'

import { Region, } from './region'

@Entity({
  name: 'aws_account',
})
export class AwsAccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accessKeyId: string;

  @Column()
  secretAccessKey: string;

  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;
}

