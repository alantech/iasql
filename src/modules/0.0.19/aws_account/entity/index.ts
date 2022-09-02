import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class AwsCredentials {
  @PrimaryGeneratedColumn()
  @cloudId
  id: number;

  @Column()
  accessKeyId: string;

  @Column()
  secretAccessKey: string;
}

@Entity()
export class AwsRegions {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @cloudId
  region: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  }) // TODO: Constrain so exactly one record has true set
  isDefault: boolean;

  @Column({
    type: 'boolean',
    nullable: false,
    default: true,
  })
  isEnabled: boolean;
}
