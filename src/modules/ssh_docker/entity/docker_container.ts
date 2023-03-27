import { MountConfig } from 'dockerode';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { SshCredentials } from '../../ssh_accounts/entity';

export enum dockerContainerStates {
  created = 'created',
  restarting = 'restarting',
  running = 'running',
  removing = 'removing',
  paused = 'paused',
  exited = 'exited',
  dead = 'dead',
}

@Entity()
export class DockerContainer {
  /**
   * @private
   * Internal ID field for container
   */
  @PrimaryGeneratedColumn()
  id: number;

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

  @cloudId
  @Column({ nullable: true })
  containerId?: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  name?: string;

  @Column()
  image: string;

  @Column({ nullable: true, type: 'jsonb' })
  env?: string[]; // ['A=B', 'C=D']

  @Column({ nullable: true, type: 'jsonb' })
  command?: string[];

  @Column({ nullable: true, type: 'jsonb' })
  entrypoint?: string[];

  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  created?: Date;

  @Column({
    type: 'jsonb',
    default: {},
    nullable: true,
  })
  ports?: { [portAndProtocol: string]: { HostIp: string; HostPort: string }[] }; // {'80/tcp': [{HostIp: '', HostPort: '81'}]}

  @Column({
    type: 'jsonb',
    default: {},
    nullable: true,
  })
  labels?: { [label: string]: string };

  @Column({ nullable: true, default: dockerContainerStates.running, enum: dockerContainerStates })
  state?: string;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  volumes?: { [volume: string]: {} };

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  mounts?: MountConfig;

  @Column({
    type: 'varchar',
    nullable: true,
    array: true,
  })
  binds?: string[];
}
