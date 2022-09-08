import { Column, Entity, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

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
  @PrimaryColumn()
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
