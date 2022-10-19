import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';
import { CodedeployApplication } from './application';
import { CodedeployDeployment } from './deployment';

export enum DeploymentConfigType {
  ALL_AT_ONCE = 'CodeDeployDefault.AllAtOnce',
  HALF_AT_A_TIME = 'CodeDeployDefault.HalfAtATime',
  ONE_AT_A_TIME = 'CodeDeployDefault.OneAtATime',
}

export enum EC2TagFilterType {
  KEY_AND_VALUE = 'KEY_AND_VALUE',
  KEY_ONLY = 'KEY_ONLY',
  VALUE_ONLY = 'VALUE_ONLY',
}

@Unique('uq_codedeploydeploymentgroup_id_region', ['id', 'region'])
@Unique('uq_codedeploydeploymentgroup_name_region', ['name', 'region'])
@Entity()
export class CodedeployDeploymentGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    nullable: true,
  })
  deploymentGroupId?: string;

  @ManyToOne(() => CodedeployApplication, {
    eager: true,
    nullable: false,
  })
  @JoinColumn([
    {
      name: 'application_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  application: CodedeployApplication;

  @Column({
    type: 'enum',
    enum: DeploymentConfigType,
    default: DeploymentConfigType.ONE_AT_A_TIME,
  })
  deploymentConfigName: DeploymentConfigType;

  @Column({
    type: 'json',
    nullable: true,
  })
  ec2TagFilters?: {
    Key: string | undefined;
    Type: EC2TagFilterType;
    Value: string | undefined;
  }[];

  @ManyToOne(() => IamRole, role => role.roleName, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'role_name',
  })
  role?: IamRole;

  @OneToMany(() => CodedeployDeployment, deployments => deployments.deploymentGroup, {
    nullable: true,
    cascade: true,
  })
  deployments?: CodedeployDeployment[];

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
