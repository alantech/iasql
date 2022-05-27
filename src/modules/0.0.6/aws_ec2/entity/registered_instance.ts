import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Instance } from '.';
import { TargetGroup } from '../../aws_elb/entity';

// TODO: add constraint to only join with target groups with type 'instance'  @Check(`target_group.target_type = "instance"`)
@Unique(['instance', 'targetGroup'])
@Entity()
export class RegisteredInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Instance, instance => instance.id, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instance', })
  instance: Instance;

  @ManyToOne(() => TargetGroup, targetGroup => targetGroup.targetGroupName, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'target_group', })
  targetGroup: TargetGroup;
}