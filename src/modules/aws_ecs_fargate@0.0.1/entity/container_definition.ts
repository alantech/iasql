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
import { TaskDefinition } from '.'

import { LogGroup } from '../../aws_cloudwatch@0.0.1/entity'
import { PublicRepository, Repository } from '../../aws_ecr@0.0.1/entity'

export enum TransportProtocol {
  TCP = "tcp",
  UDP = "udp"
}

// `image` > `repository` > `publicRepository`
// `digest` > `tag` > null
@Check(`("image" is null and ("repository_id" is not null or "public_repository_id" is not null)) or "image" is not null`)
@Check(`("tag" is null and "digest" is null) or ("tag" is not null and "digest" is null) or ("tag" is null and "digest" is not null)`)
@Entity()
export class ContainerDefinition {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @ManyToOne(() => TaskDefinition)
  @JoinColumn({
    name: 'task_definition_id',
  })
  taskDefinition: TaskDefinition;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column({ nullable: true, })
  image?: string;

  @Column({ nullable: true, })
  tag?: string;

  @Column({ nullable: true, })
  digest?: string;

  @ManyToOne(() => Repository, {
    nullable: true,
    eager: true,
    cascade: true,
  })
  @JoinColumn({
    name: "repository_id"
  })
  repository?: Repository;

  @ManyToOne(() => PublicRepository, {
    nullable: true,
    eager: true,
    cascade: true,
  })
  @JoinColumn({
    name: "public_repository_id"
  })
  publicRepository?: PublicRepository;

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

  @ManyToOne(() => LogGroup, {
    nullable: true,
    eager: true,
    cascade: true,
  })
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
