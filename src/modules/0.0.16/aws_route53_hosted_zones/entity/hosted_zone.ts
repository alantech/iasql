import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class HostedZone {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
    nullable: true,
  })
  @cloudId
  hostedZoneId: string;

  @Column()
  domainName: string;
}
