import { PrimaryGeneratedColumn, Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { Instance } from '.';
import { AwsRegions } from '../../aws_account/entity';
import { TargetGroup } from '../../aws_elb/entity';

@Entity()
@Check('check_target_group_instance', 'check_target_group_instance(target_group)')
export class RegisteredInstance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Instance, instance => instance.id, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'instance',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  instance: Instance;

  @ManyToOne(() => TargetGroup, targetGroup => targetGroup.targetGroupName, {
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

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
