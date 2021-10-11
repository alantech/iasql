import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class DomainMembership {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  domain: string;

  @Column({
    nullable: true,
  })
  status?: string;

  @Column({
    nullable: true,
  })
  fqdn?: string;

  @Column({
    nullable: true,
  })
  iamRoleName?: string;
}
