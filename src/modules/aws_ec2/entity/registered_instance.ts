import { PrimaryGeneratedColumn, Check, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { Instance } from '.';
import { AwsRegions } from '../../aws_account/entity';
import { TargetGroup } from '../../aws_elb/entity';

/**
 * Table to track the EC2 instances that are registered into load balancers
 *
 * @example
 * ```sql TheButton[Associate an EC2 instance to a load balancer]="Associate an EC2 instance to a load balancer"
 * INSERT INTO registered_instance (instance, target_group_id) SELECT (SELECT id FROM instance WHERE tags ->> 'name' = 'test-vm'), (SELECT id FROM target_group WHERE target_group_name = 'test-target-group');
 *
 * UPDATE registered_instance SET port = '80' FROM instance WHERE instance.id = registered_instance.instance AND target_group_id = (SELECT id FROM target_group WHERE target_group_name = 'test-target-group')
 * AND instance.tags ->> 'name' = 'test-vm';
 *
 * DELETE FROM registered_instance USING instance WHERE instance.tags ->> 'name' = 'test-vm' AND instance.id = registered_instance.instance;
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L614
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/elb-deregister-register-instances.html
 */
@Entity()
@Check('check_target_group_instance', 'check_target_group_instance(target_group_id)')
export class RegisteredInstance {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Reference to the instance to associate with the specific load balancer
   */
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

  /**
   * @public
   * Reference to the target group for the association
   */
  @ManyToOne(() => TargetGroup, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  targetGroup: TargetGroup;

  /**
   * @public
   * Port to expose in that association
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;

  /**
   * @public
   * Region for the VM association
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
