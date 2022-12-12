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

import { Cluster, TaskDefinition } from '.';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { TargetGroup } from '../../aws_elb/entity';
import { SecurityGroup } from '../../aws_security_group/entity';

/**
 * @enum
 * Either to assign public ip or not
 */
export enum AssignPublicIp {
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
}

/**
 * Table to manage AWS ECS services. You can use an Amazon ECS service to run and maintain a specified number of instances of a
 * task definition simultaneously in an Amazon ECS cluster. If one of your tasks fails or stops, the Amazon ECS service
 * scheduler launches another instance of your task definition to replace it. This helps maintain your desired number of tasks in the service.
 *
 * @example
 * ```sql
 * INSERT INTO service ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
 * VALUES ('service_name', 1, (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = 'us-east-1' limit 3)),
 * 'ENABLED', (SELECT id FROM cluster WHERE cluster_name = '${clusterName}'), (select id from task_definition where family = 'task-definition' and region = 'us-east-1'
 * order by revision desc limit 1), (SELECT id FROM target_group WHERE target_group_name = 'target-group' and region = 'us-east-1'));
 * SELECT * FROM service WHERE name = 'service-name';
 * delete from service where name = 'service-name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L516
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html
 */
@Entity()
@Check('check_service_subnets', 'check_service_subnets(subnets)')
@Unique('uq_service_name_region', ['name', 'region'])
export class Service {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name of the container definition
   */
  @Column()
  name: string;

  /**
   * @public
   * AWS ARN for the service
   */
  @Column({
    nullable: true,
  })
  @cloudId
  arn?: string;

  /**
   * @public
   * Current status of the service
   */
  @Column({
    nullable: true,
  })
  status?: string;

  /**
   * @public
   * Reference to the cluster where the service belongs to
   */
  @ManyToOne(() => Cluster, {
    eager: true,
  })
  @JoinColumn({
    name: 'cluster_id',
  })
  cluster?: Cluster;

  /**
   * @public
   * Reference to the task definition that uses the service
   */
  @ManyToOne(() => TaskDefinition, {
    eager: true,
  })
  @JoinColumn({
    name: 'task_definition_id',
  })
  task?: TaskDefinition;

  /**
   * @public
   * The desired number of instantiations of the task definition to keep running on the service.
   */
  @Column({
    type: 'int',
  })
  desiredCount?: number;

  /**
   * @public
   * Ids of all the VPC subnets used by the service
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration
   */
  @Column('text', { array: true })
  subnets: string[];

  /**
   * @public
   * Reference to all the security groups used by the service
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration
   */
  @ManyToMany(() => SecurityGroup, {
    eager: true,
  })
  @JoinTable({
    name: 'service_security_groups',
  })
  securityGroups: SecurityGroup[];

  /**
   * @public
   * Whether to assign a public IP to the service
   */
  @Column({
    type: 'enum',
    enum: AssignPublicIp,
    default: AssignPublicIp.DISABLED,
  })
  assignPublicIp: AssignPublicIp;

  /**
   * @public
   * Reference of the target group that will be associated with the service, to expose it via load balancers
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/register-multiple-targetgroups.html
   */
  @ManyToOne(() => TargetGroup, {
    eager: true,
  })
  @JoinColumn()
  targetGroup?: TargetGroup;

  /**
   * @public
   * Region for the ECS service
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
