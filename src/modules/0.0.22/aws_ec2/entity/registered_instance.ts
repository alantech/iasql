import { Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { Instance } from '.';
import { TargetGroup } from '../../aws_elb/entity';

@Entity()
@Check('check_target_group_instance', 'check_target_group_instance(target_group)')
export class RegisteredInstance {
  @ManyToOne(() => Instance, instance => instance.id, {
    primary: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instance' })
  instance: Instance;

  @ManyToOne(() => TargetGroup, targetGroup => targetGroup.targetGroupName, {
    primary: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'target_group' })
  targetGroup: TargetGroup;

  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;
}
