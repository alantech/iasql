import {
  Column,
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ArtifactStore, StageDeclaration } from '@aws-sdk/client-codepipeline';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';

export enum ActionCategory {
  Approval = 'Approval',
  Build = 'Build',
  Deploy = 'Deploy',
  Invoke = 'Invoke',
  Source = 'Source',
  Test = 'Test',
}

@Entity()
@Unique('uq_pipeline_name_region', ['name', 'region'])
export class PipelineDeclaration {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  @Column({
    type: 'json',
    nullable: false,
  })
  artifactStore: ArtifactStore;

  @ManyToOne(() => IamRole, {
    eager: true,
  })
  @JoinColumn({
    name: 'service_role_name',
  })
  serviceRole: IamRole;

  @Column({
    type: 'json',
    nullable: true,
  })
  stages?: StageDeclaration[] | undefined;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
