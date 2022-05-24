import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Instance } from './instance';
import { TargetGroup } from '../../aws_elb/entity';

// TODO: add constraint to only join with target groups with type 'instance'  @Check(`target_group.target_type = "instance"`)
@Unique(['instance', 'targetGroup'])
@Entity()
export class RegisteredInstances {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Instance, instance => instance.id)
  @JoinColumn({ name: 'instance', })
  instance: Instance;

  @ManyToOne(() => TargetGroup, targetGroup => targetGroup.targetGroupName)
  @JoinColumn({ name: 'target_group', })
  targetGroup: TargetGroup;
}