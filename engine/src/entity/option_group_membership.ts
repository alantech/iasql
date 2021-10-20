import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { noDiff, } from '../services/diff'

@Entity()
export class OptionGroupMembership {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  optionGroupName?: string;

  @Column({
    nullable: true,
  })
  status?: string;
}
