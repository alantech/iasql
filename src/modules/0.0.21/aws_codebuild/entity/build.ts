import { Column, Entity, PrimaryGeneratedColumn, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
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
export class CodebuildBuildList {
  // AWS unique ID for the build.
  @PrimaryColumn()
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
  @JoinColumn({
    name: 'project_name',
  })
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
}

// TODO allow overrides
@Entity()
export class CodebuildBuildImport {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CodebuildProject, {
    eager: true,
  })
  @JoinColumn({
    name: 'project_name',
  })
  project: CodebuildProject;
}
