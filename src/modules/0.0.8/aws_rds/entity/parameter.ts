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

  @ManyToOne(() => ParameterGroup)
  @JoinColumn({
    name: 'parameter_group_name',
  })
  parameterGroup: ParameterGroup;

  @Column()
  name: string;

  @Column({ nullable: true, })
  value?: string;

  @Column()
  description: string;

  @Column()
  source: string;

  @Column()
  applyType: string;

  @Column()
  dataType: string;

  @Column({ default: false, })
  isModifiable: boolean;

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