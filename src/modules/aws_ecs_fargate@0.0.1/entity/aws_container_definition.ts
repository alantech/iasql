import {
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { AwsTaskDefinition } from '.'

import { LogGroup } from '../../aws_cloudwatch@0.0.1/entity'
import { AwsPublicRepository, AwsRepository } from '../../aws_ecr@0.0.1/entity'

export enum TransportProtocol {
  TCP = "tcp",
  UDP = "udp"
}

// `image` > `repository` > `publicRepository`
// `tag` > `digest` > null
@Check(`image is null and (repository is not null or publicRepository is not null)`)
@Check(`image is null and (tag is not null or digest is not null)`)
@Entity()
export class AwsContainerDefinition {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @ManyToOne(() => AwsTaskDefinition)
  @JoinColumn({
    name: 'task_definition_id',
  })
  taskDefinition: AwsTaskDefinition;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column({ nullable: true, })
  image?: string;

  @Column({ nullable: true, })
  tag?: string;

  @Column({ nullable: true, })
  digest?: string;

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

  @Column({
    type: 'int',
    nullable: true,
  })
  hostPort?: number;

  @Column({
    type: 'int',
    nullable: true,
  })
  containerPort?: number;

  @Column({
    type: 'enum',
    enum: TransportProtocol,
    nullable: true,
  })
  protocol?: TransportProtocol;

  @Column({
    type: 'simple-json',
    nullable: true,
  })
  envVariables: { [key: string]: string };

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
