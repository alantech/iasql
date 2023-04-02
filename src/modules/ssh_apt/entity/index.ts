import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { SshCredentials } from '../../ssh_accounts/entity';

@Entity()
@Unique('uq_package_server_package_version_arch', ['server', 'package', 'version', 'architecture'])
export class Package {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name of the ssh server
   */
  @Column({
    type: 'varchar',
    nullable: false,
  })
  @ManyToOne(() => SshCredentials, { nullable: false })
  @JoinColumn({ referencedColumnName: 'name', name: 'server' })
  @cloudId
  server: string;

  /**
   * @public
   * Name of the package
   */
  @Column({
    type: 'varchar',
    nullable: false,
  })
  @cloudId
  package: string;

  /**
   * @public
   * The version of the package
   */
  @Column({
    type: 'varchar',
    nullable: false,
  })
  @cloudId
  version: string;

  /**
   * The architecture of the package
   */
  @Column({
    type: 'varchar', // TODO: Maybe make this an enum?
    nullable: false,
  })
  @cloudId
  architecture: string;

  /**
   * @public
   * The description of the package
   */
  @Column({
    type: 'varchar',
    nullable: true,
  })
  description?: string;

  /**
   * @public
   * Whether or not the package is installed
   */
  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  installed: boolean;

  /**
   * @public
   * Whether or not the package is upgradable
   */
  @Column({
    type: 'boolean',
    nullable: false,
    default: false,
  })
  upgradable: boolean;
}
