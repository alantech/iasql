import { NetworkInfo, Port } from 'dockerode';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { SshCredentials } from '../../ssh_accounts/entity';

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
  containerId: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  name: string;

  @Column()
  image: string;

  @Column({ nullable: true })
  imageId: string;

  @Column({ nullable: true })
  command: string;

  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  created: Date;

  @Column({
    type: 'jsonb',
    default: [],
  })
  ports: Port[];

  @Column({
    type: 'jsonb',
    default: {},
  })
  labels: { [label: string]: string };

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  status: string;

  @Column({
    type: 'jsonb',
    default: { NetworkMode: 'default' },
  })
  hostConfig: { NetworkMode: string };

  @Column({ type: 'jsonb', nullable: true })
  networkSettings: { Networks: { [networkType: string]: NetworkInfo } };

  @Column({ type: 'jsonb', default: [] })
  mounts: {
    Name?: string | undefined;
    Type: string;
    Source: string;
    Destination: string;
    Driver?: string | undefined;
    Mode: string;
    RW: boolean;
    Propagation: string;
  }[];
}
