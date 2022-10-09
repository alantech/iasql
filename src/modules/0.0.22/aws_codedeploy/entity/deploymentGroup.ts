import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
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

@Entity()
export class CodedeployDeploymentGroup {
  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({
    nullable: true,
  })
  id?: string;

  @ManyToOne(() => CodedeployApplication, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'application_name',
  })
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
}
