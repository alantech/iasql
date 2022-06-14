import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ParameterGroup } from './parameter_group';

@Entity()
export class Parameter {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ParameterGroup, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'parameter_group_name',
  })
  parameterGroup: ParameterGroup;

  @Column()
  name: string;

  @Column({ nullable: true, })
  value?: string;

  @Column({ nullable: true, })
  description?: string;

  @Column({ nullable: true, })
  source?: string;

  @Column({ nullable: true, })
  applyType?: string;

  @Column({ nullable: true, })
  dataType?: string;

  @Column({ default: false, })
  isModifiable: boolean;

  @Column({ nullable: true, })
  allowedValues?: string;

  @Column({ nullable: true, })
  applyMethod?: string;

  @Column({ nullable: true, })
  minimumEngineVersion?: string;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}