import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { CodedeployDeploymentGroup } from './deploymentGroup';
import { CodedeployRevision } from './revision';

export enum ComputePlatform {
  Lambda = 'Lambda',
  Server = 'Server',
}

@Entity()
export class CodedeployApplication {
  @PrimaryColumn()
  @cloudId
  name: string;

  @Column({
    nullable: true,
  })
  applicationId?: string;

  @Column({
    type: 'enum',
    enum: ComputePlatform,
    default: ComputePlatform.Server,
  })
  computePlatform: ComputePlatform;

  @OneToMany(() => CodedeployDeploymentGroup, deploymentGroups => deploymentGroups.application, {
    nullable: true,
    cascade: true,
  })
  deploymentGroups?: CodedeployDeploymentGroup[];

  @OneToMany(() => CodedeployRevision, revisions => revisions.application, {
    nullable: true,
    cascade: true,
    eager: true,
  })
  revisions?: CodedeployRevision[];
}
