import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  Check,
  ManyToOne,
  JoinColumn,
} from 'typeorm'

import { LogGroup } from '../../aws_cloudwatch/entity'
import { AwsRepository } from '../../aws_ecr/entity/aws_repository'
import { EnvVariable } from './env_variable'
import { PortMapping } from './port_mapping'

@Check(`"docker_image" is not null or "repository_id" is not null`)
@Entity()
export class Container {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ unique: true, })
  name: string;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column({ nullable: true, })
  dockerImage?: string;

  @ManyToOne(() => AwsRepository, { nullable: true, })
  @JoinColumn({
    name: "repository_id"
  })
  repository?: AwsRepository;

  @Column()
  tag: string;

  @Column({
    default: false,
  })
  essential: boolean;

  @Column({
    type: 'int',
    nullable: true,
  })
  cpu?: number;

  @Column({
    type: 'int',
    nullable: true,
  })
  memory?: number;

  @Column({
    type: 'int',
    nullable: true,
  })
  memoryReservation?: number;

  @ManyToMany(() => PortMapping, { cascade: true, eager: true, })
  @JoinTable()
  portMappings?: PortMapping[];

  @ManyToMany(() => EnvVariable, { cascade: true, eager: true, })
  @JoinTable()
  environment?: EnvVariable[];

  @ManyToOne(() => LogGroup, { nullable: true, })
  @JoinColumn({
    name: 'log_group_id',
  })
  logGroup?: LogGroup;
}
