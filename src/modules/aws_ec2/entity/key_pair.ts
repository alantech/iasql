import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { KeyType } from '@aws-sdk/client-ec2';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage keypairs for EC2 instances. A key pair, consisting of a public key and a private key, is a set of
 * security credentials that you use to prove your identity when connecting to an Amazon EC2 instance.
 *
 * Amazon EC2 stores the public key on your instance, and you store the private key.
 *
 * Keys can only be listed and deleted.
 * The keypairs can be created using `key_pair_request` and `key_pair_import` methods.
 *
 * @example
 * ```sql TheButton[Manage EC2 keypairs]="Manage EC2 keypairs"
 * SELECT * FROM key_pair WHERE name = 'key';
 * DELETE FROM key_pair WHERE name = 'key';
 * ```
 *
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
 * @see https://aws.amazon.com/ec2/features
 */
@Entity()
@Unique('uq_keypair_id_region', ['id', 'region'])
@Unique('uq_keypair_name_region', ['name', 'region'])
export class KeyPair {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the EC2 keypair
   */
  @Column()
  @cloudId
  name: string;

  /**
   * @public
   * AWS generated ID for the keypair
   */
  @Column({ nullable: true })
  keyPairId?: string;

  /**
   * @public
   * Type for the key
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/keytype.html
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: KeyType,
  })
  type: KeyType;

  /**
   * @public
   * Generated fingerprint for the keypair
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/verify-keys.html
   */
  @Column({ nullable: true })
  fingerprint?: string;

  /**
   * @public
   * Public key for the keypair. This will be used to grant ssh access to the associated instances.
   */
  @Column({ nullable: true })
  publicKey?: string;

  /**
   * @public
   * Region for the keypair
   */
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
