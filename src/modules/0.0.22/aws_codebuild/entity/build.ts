import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { CodebuildProject } from './project';

export enum BuildStatus {
  FAILED = 'FAILED',
  FAULT = 'FAULT',
  IN_PROGRESS = 'IN_PROGRESS',
  STOPPED = 'STOPPED',
  SUCCEEDED = 'SUCCEEDED',
  TIMED_OUT = 'TIMED_OUT',
}

@Entity()
@Unique('uq_codebuildlist_id_region', ['id', 'region'])
@Unique('uq_codebuildlist_name_region', ['awsId', 'region'])
export class CodebuildBuildList {
  @PrimaryGeneratedColumn()
  id: number;

  // AWS unique ID for the build.
  @Column()
  @cloudId
  awsId: string;

  @Column({
    nullable: true,
  })
  arn: string;

  // The number of the build. For each project, the buildNumber of its first build is 1. The buildNumber of each subsequent build is incremented by 1. If a build is deleted, the buildNumber of other builds does not change.
  @Column({
    nullable: true,
  })
  buildNumber?: number;

  // AWS allows builds to exist once the project has been deleted
  @ManyToOne(() => CodebuildProject, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'project_name',
      referencedColumnName: 'projectName',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  project: CodebuildProject;

  @Column({
    type: 'enum',
    enum: BuildStatus,
  })
  buildStatus: BuildStatus;

  @Column({
    type: 'timestamp without time zone',
    nullable: true,
  })
  endTime?: Date;

  @Column({
    type: 'timestamp without time zone',
    nullable: true,
  })
  startTime?: Date;

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

// TODO allow overrides
@Entity()
export class CodebuildBuildImport {
  @PrimaryGeneratedColumn()
  @cloudId
  id: number;

  @ManyToOne(() => CodebuildProject, {
    eager: true,
  })
  @JoinColumn([
    {
      name: 'project_name',
      referencedColumnName: 'projectName',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  project: CodebuildProject;

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
