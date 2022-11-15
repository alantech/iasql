import {
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';
// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup } from '../../aws_security_group/entity';
import { Subnet } from '../../aws_vpc/entity';

// "terminated" is ommittted because that is achieved by deleting the row
// "pending", "shutting-down", "stopping" are ommitted because they are interim states
export enum State {
  RUNNING = 'running',
  STOPPED = 'stopped',
  HIBERNATE = 'hibernate',
}

@Entity()
@Check('check_role_ec2', 'role_name IS NULL OR (role_name IS NOT NULL AND check_role_ec2(role_name))')
@Unique('instance_id_region', ['id', 'region']) // So the General Purpose Volume entity can join on both
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
    comment: 'Unique identifier provided by AWS once the instance is provisioned',
  })
  @cloudId
  instanceId?: string;

  @Column()
  ami: string;

  @Column()
  instanceType: string;

  @Column({
    nullable: true,
  })
  keyPairName: string;

  @Column({
    type: 'enum',
    enum: State,
    default: State.RUNNING,
  })
  state: State;

  @Column({
    type: 'text',
    nullable: true,
  })
  userData?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'instance_security_groups',
  })
  securityGroups: SecurityGroup[];

  @ManyToOne(() => IamRole, role => role.roleName, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'role_name',
  })
  role?: IamRole;

  @ManyToOne(() => Subnet, subnet => subnet.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'subnet_id',
  })
  subnet?: Subnet;

  @Column({
    default: false,
  })
  hibernationEnabled: boolean;

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
