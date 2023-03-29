import { MountConfig } from 'dockerode';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { SshCredentials } from '../../ssh_accounts/entity';

/**
 * @enum
 * Different states a docker container can be - it's used to start/pause/unpause/stop the container
 */
export enum dockerContainerStates {
  created = 'created',
  restarting = 'restarting',
  running = 'running',
  removing = 'removing',
  paused = 'paused',
  exited = 'exited',
  dead = 'dead',
}

/**
 * Table to manage docker containers
 * You can manage docker containers on your hosts that are registered in ssh_accounts module
 */
@Entity()
export class DockerContainer {
  /**
   * @private
   * Internal ID field for container
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Server name that is inserted into ssh_credentials table
   */
  @cloudId
  @Column({
    type: 'character varying',
    nullable: false,
  })
  @ManyToOne(() => SshCredentials, { nullable: false })
  @JoinColumn([
    {
      name: 'server_name',
      referencedColumnName: 'name',
    },
  ])
  serverName: string;

  /**
   * @public
   * Id that docker engine has assigned to this container
   */
  @cloudId
  @Column({ nullable: true })
  containerId?: string;

  /**
   * @public
   * Name of the docker container - either set by user or auto-generated by docker engine
   */
  @Column({
    type: 'varchar',
    nullable: true,
  })
  name?: string;

  /**
   * @public
   * Image of the docker container - eg. ubuntu, iasql/iasql:latest
   */
  @Column()
  image: string;

  /**
   * @public
   * Environment variables as a list, in form of {'A=B', 'C=D'}
   */
  @Column({ nullable: true, type: 'varchar', array: true })
  env?: string[]; // ['A=B', 'C=D']

  /**
   * @public
   * CMD of the docker container
   */
  @Column({ nullable: true, type: 'varchar', array: true })
  command?: string[];

  /**
   * @public
   * Entrypoint of the docker container
   */
  @Column({ nullable: true, type: 'varchar', array: true })
  entrypoint?: string[];

  /**
   * @public
   * Creation date of the docker container
   */
  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  created?: Date;

  /**
   * @public
   * Port binding of the docker container to the host, for example {'80/tcp': [{HostIp: '', HostPort: '81'}]}
   */
  @Column({
    type: 'jsonb',
    default: {},
    nullable: true,
  })
  ports?: { [portAndProtocol: string]: { HostIp: string; HostPort: string }[] };

  /**
   * @public
   * Labels for the docker container - for example {'l1': 'l1-value', 'l2': 'l2-value'}
   */
  @Column({
    type: 'jsonb',
    default: {},
    nullable: true,
  })
  labels?: { [label: string]: string };

  /**
   * @public
   * State of the docker container - it can be used to start/stop/pause/unpause the container
   */
  @Column({ nullable: true, default: dockerContainerStates.running, enum: dockerContainerStates })
  state?: string;

  /**
   * @public
   * Volume definition of the docker container - for example {'vol-name': {}}
   */
  @Column({
    type: 'varchar',
    array: true,
    nullable: true,
  })
  volumes?: string[];

  /**
   * @public
   * Mount config for the volumes
   */
  @Column({
    type: 'jsonb',
    nullable: true,
  })
  mounts?: MountConfig;

  /**
   * @public
   * A list of container's bind mounts - for example {'/home/my-app:/app'}
   */
  @Column({
    type: 'varchar',
    nullable: true,
    array: true,
  })
  binds?: string[];
}
