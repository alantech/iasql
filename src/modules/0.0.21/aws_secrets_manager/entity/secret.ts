import { Column, Entity, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class Secret {
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    type: String,
    nullable: true,
  })
  value?: string | null;

  @Column({
    nullable: true,
  })
  versionId?: string;
}
