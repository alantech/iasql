import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { IamUser } from './user';

/**
 * @enum
 * Different states for an access key. Only Active keys can be used to access.
 */
export enum accessKeyStatusEnum {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

/**
 * Table to manage access keys for IAM users. Access keys are long-term credentials for an IAM user or the AWS account root user.
 * You can use access keys to sign programmatic requests to the AWS CLI or AWS API (directly or using the AWS SDK).
 *
 * Access keys consist of two parts: an access key ID (for example, AKIAIOSFODNN7EXAMPLE) and a secret access key (for example, wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY).
 * Like a user name and password, you must use both the access key ID and secret access key together to authenticate your requests.
 *
 * Access keys can only be listed and deleted. The access keys can be created using the `access_key_request` method.
 *
 * @example
 * ```sql TheButton[Manage Access Keys]="Manage Access Keys"
 * SELECT * FROM access_key WHERE user_name='user';
 * DELETE FROM access_key WHERE user_name = 'user';
 * ```
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 */
@Entity()
export class AccessKey {
  /**
   * @internal
   * Internal ID field for storing access keys
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS generated ID for the access key
   */
  @Column({ nullable: false })
  @cloudId
  accessKeyId: string;

  /**
   * @public
   * Creation date
   */
  @CreateDateColumn({
    type: 'timestamptz',
  })
  createDate: Date;

  /**
   * @public
   * Status of the Access Key
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: accessKeyStatusEnum,
  })
  status?: accessKeyStatusEnum;

  /**
   * @public
   * Reference to the user for this record
   */
  @ManyToOne(() => IamUser, { nullable: false })
  @JoinColumn({
    name: 'user_name',
  })
  @cloudId
  user: IamUser;
}
