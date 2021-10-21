import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { EnvironmetVariable } from './environmet_variable';
import { PortMapping } from './port_mapping';

@Entity()
export class ContainerDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column()
  image: string;

  @Column({
    default: false,
  })
  essential: boolean;

  @ManyToMany(() => PortMapping)
  @JoinTable()
  portMappings?: PortMapping[];

  @ManyToMany(() => EnvironmetVariable)
  @JoinTable()
  environment?: EnvironmetVariable[];

  // TODO: add when needed
  // @Column({
  //   nullable: true,
  // })
  // repositoryCredentials?: RepositoryCredentials;

  // @Column({
  //   nullable: true,
  // })
  // cpu?: number;

  // @Column({
  //   nullable: true,
  // })
  // memory?: number;

  // @Column({
  //   nullable: true,
  // })
  // memoryReservation?: number;

  //command?: string[];

  // environmentFiles?: EnvironmentFile[];

  // mountPoints?: MountPoint[];

  // volumesFrom?: VolumeFrom[];

  // linuxParameters?: LinuxParameters;

  // secrets?: Secret[];

  // dependsOn?: ContainerDependency[];

  // startTimeout?: number;

  // stopTimeout?: number;

  // hostname?: string;

  // user?: string;

  // workingDirectory?: string;

  // disableNetworking?: boolean;

  // privileged?: boolean;

  // readonlyRootFilesystem?: boolean;

  // dnsServers?: string[];

  // dnsSearchDomains?: string[];

  // extraHosts?: HostEntry[];

  // dockerSecurityOptions?: string[];

  // interactive?: boolean;

  // pseudoTerminal?: boolean;

  // dockerLabels?: {
  //     [key: string]: string;
  // };

  // ulimits?: Ulimit[];

  // logConfiguration?: LogConfiguration;

  // healthCheck?: HealthCheck;

  // systemControls?: SystemControl[];

  // resourceRequirements?: ResourceRequirement[];

  // firelensConfiguration?: FirelensConfiguration;
}
