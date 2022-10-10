import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

export enum EncryptionKeyType {
  KMS = 'KMS',
}
export enum ArtifactStoreType {
  S3 = 'S3',
}
export enum ActionCategory {
  Approval = 'Approval',
  Build = 'Build',
  Deploy = 'Deploy',
  Invoke = 'Invoke',
  Source = 'Source',
  Test = 'Test',
}

export interface ActionTypeId {
  category: ActionCategory | string | undefined;
  provider: string | undefined;
}

export interface ActionDeclaration {
  name: string;
  actionTypeId: ActionTypeId | undefined;
  runOrder?: number;
  configuration?: Record<string, string>;
  outputArtifacts?: {
    name: string;
  }[];
  inputArtifacts?: {
    name: string;
  }[];
  roleArn?: string;
  region?: string;
  namespace?: string;
}

export interface StageDeclaration {
  name: string | undefined;
  actions: ActionDeclaration[] | undefined;
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
  artifactStore: {
    encryptionKey: {
      id: string;
      type: EncryptionKeyType;
    };
    location: string;
    type: ArtifactStoreType;
  };

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
