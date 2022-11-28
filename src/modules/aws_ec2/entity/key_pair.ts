import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { KeyType } from '@aws-sdk/client-ec2';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
@Unique('uq_keypair_id_region', ['id', 'region'])
@Unique('uq_keypair_name_region', ['name', 'region'])
export class KeyPair {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @cloudId
  name: string;

  @Column({ nullable: true })
  keyPairId?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: KeyType,
  })
  type: KeyType;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @Column({ nullable: true })
  fingerprint?: string;

  @Column({ nullable: true })
  publicKey?: string;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
