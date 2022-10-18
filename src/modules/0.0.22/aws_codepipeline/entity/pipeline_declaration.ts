import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { ArtifactStore, StageDeclaration } from '@aws-sdk/client-codepipeline';

import { cloudId } from '../../../../services/cloud-id';
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
export class PipelineDeclaration {
  @PrimaryColumn({
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
}
