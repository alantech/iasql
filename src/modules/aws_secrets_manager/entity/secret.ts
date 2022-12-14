import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS secrets. AWS Secrets Manager helps you manage, retrieve, and rotate database credentials, API keys, and other secrets throughout their lifecycles.
 *
 * A secret can be a password, a set of credentials such as a user name and password, an OAuth token, or other secret information that you store in an encrypted form in Secrets Manager.
 *
 * @example
 * ```sql TheButton[Manage a secret]="Manage a secret"
 * INSERT INTO secret (name, description, value) VALUES ('secret_name', 'description', 'value');
 * SELECT * FROM secret WHERE description='description';
 * DELETE FROM secret WHERE description='description';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-secret-integration.ts#L109
 * @see https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html
 */
@Entity()
export class Secret {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the secret
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  /**
   * @public
   * Description for the secret
   */
  @Column({
    nullable: true,
  })
  description?: string;

  /**
   * @public
   * Value to keep as secret
   */
  @Column({
    type: String,
    nullable: true,
  })
  value?: string | null;

  /**
   * @public
   * A secret has versions which hold copies of the encrypted secret value.
   * When you change the secret value, or the secret is rotated, Secrets Manager creates a new version.
   * @see https://docs.aws.amazon.com/secretsmanager/latest/userguide/getting-started.html#term_version
   */
  @Column({
    nullable: true,
  })
  versionId?: string;

  /**
   * @public
   * Region for the secret
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
