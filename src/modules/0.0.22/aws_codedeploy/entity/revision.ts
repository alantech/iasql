import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { CodedeployApplication } from './application';

export enum RevisionType {
  S3 = 'S3',
  GITHUB = 'Github',
}

@Entity()
export class CodedeployRevision {
  @PrimaryGeneratedColumn()
  @cloudId
  id: number;

  @Column({
    nullable: true,
  })
  description?: string;

  @ManyToOne(() => CodedeployApplication, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'application_name',
  })
  application: CodedeployApplication;

  @Column({
    type: 'json',
    nullable: false,
  })
  location: {
    githubLocation?:
      | {
          // the GitHub account and repository pair that stores a reference to the commit that represents the bundled artifacts for the application revision. Specified as account/repository.
          repository?: string | undefined;
          commitId?: string | undefined;
        }
      | undefined;
    revisionType: RevisionType;
    s3Location?:
      | {
          bucket?: string | undefined;
          key?: string | undefined;
          version?: string | undefined;
        }
      | undefined;
  };
}
