import { Column, Entity, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

export enum ComputePlatform {
  LAMBDA = 'LAMBDA',
  SERVER = 'SERVER',
}

@Entity()
export class CodedeployApplication {
  @PrimaryColumn()
  @cloudId
  applicationName: string;

  @Column({
    nullable: true,
  })
  applicationId?: string;

  @Column({
    type: 'enum',
    enum: ComputePlatform,
    default: ComputePlatform.SERVER,
  })
  computePlatform: ComputePlatform;
}
