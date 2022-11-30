import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { CodedeployDeploymentGroup } from './deploymentGroup';

export enum ComputePlatform {
  Lambda = 'Lambda',
  Server = 'Server',
}

@Unique('uq_codedeployapp_id_region', ['id', 'region'])
@Unique('uq_codedeployapp_name_region', ['name', 'region'])
@Entity()
export class CodedeployApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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
