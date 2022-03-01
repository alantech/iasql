import {
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { LogGroup } from '../../aws_cloudwatch@0.0.1/entity'
import { AwsPublicRepository, AwsRepository } from '../../aws_ecr@0.0.1/entity'
import { EnvVariable } from './env_variable'
import { PortMapping } from './port_mapping'

@Check(`"docker_image" is not null or "repository_id" is not null  or "public_repository_id" is not null`)
@Entity()
export class ContainerDefinition {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column({ nullable: true, })
  dockerImage?: string;

  @ManyToOne(() => AwsRepository, { nullable: true, })
  @JoinColumn({
    name: "repository_id"
  })
  repository?: AwsRepository;

  @ManyToOne(() => AwsPublicRepository, { nullable: true, })
  @JoinColumn({
    name: "public_repository_id"
  })
  publicRepository?: AwsPublicRepository;

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

  @ManyToMany(() => PortMapping, { cascade: true, })
  @JoinTable()
  portMappings?: PortMapping[];

  @ManyToMany(() => EnvVariable, { cascade: true, })
  @JoinTable()
  environment?: EnvVariable[];

  @ManyToOne(() => LogGroup, { nullable: true, })
  @JoinColumn({
    name: 'log_group_id',
  })
  logGroup?: LogGroup;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}
