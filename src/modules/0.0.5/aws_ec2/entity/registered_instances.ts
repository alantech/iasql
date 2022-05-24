import {
  Check,
  Column,
  Entity,
  JoinColumn,
} from 'typeorm';

import { Instance } from './instance';
import { TargetGroup } from '../../aws_elb/entity';

@Check(`target_group.target_type = "instance"`)
@Entity()
export class RegisteredInstances {
  @Column({ primary: true, })
  @JoinColumn({
    name: 'instance',
    referencedColumnName: 'id',
  })
  instance: Instance;

  @Column({ primary: true, })
  @JoinColumn({
    name: 'target_group',
    referencedColumnName: 'targetGroupName'
  })
  targetGroup: TargetGroup;
}