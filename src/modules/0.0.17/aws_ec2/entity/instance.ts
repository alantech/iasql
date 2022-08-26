import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup } from '../../aws_security_group/entity';
import { cloudId } from '../../../../services/cloud-id';
import { Role } from '../../aws_iam/entity';
import { Subnet } from '../../aws_vpc/entity';

// "terminated" is ommittted because that is achieved by deleting the row
// "pending", "shutting-down", "stopping" are ommitted because they are interim states
export enum State {
  RUNNING = 'running',
  STOPPED = 'stopped',
  HIBERNATE = 'hibernate',
}

@Entity()
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

  @ManyToOne(() => Role, role => role.roleName, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'role_name',
  })
  role?: Role;

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
}
