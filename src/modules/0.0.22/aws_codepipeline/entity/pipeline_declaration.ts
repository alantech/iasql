import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { ArtifactStore, StageDeclaration } from '@aws-sdk/client-codepipeline';

import { cloudId } from '../../../../services/cloud-id';

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

  @Column({
    nullable: true,
  })
  roleArn?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  stages?: StageDeclaration[] | undefined;
}
