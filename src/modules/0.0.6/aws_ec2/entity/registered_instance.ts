import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';

import { Instance } from '.';
import { TargetGroup } from '../../aws_elb/entity';

// TODO: add constraint to only join with target groups with type 'instance'  @Check(`target_group.target_type = "instance"`)
@Entity()
export class RegisteredInstance {
  @ManyToOne(() => Instance, instance => instance.id, {
    primary: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'instance', })
  instance: Instance;

  @ManyToOne(() => TargetGroup, targetGroup => targetGroup.targetGroupName, {
    primary: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'target_group', })
  targetGroup: TargetGroup;

  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;

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