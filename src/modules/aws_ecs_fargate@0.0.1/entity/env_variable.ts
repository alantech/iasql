import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { ContainerDefinition } from '../../aws_ecs@0.0.1/entity';

@Entity()
export class EnvVariable {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column()
  value: string;

  @ManyToOne(() => ContainerDefinition)
  @JoinColumn({
    name: 'container_definition_id',
  })
  containerDefinition: ContainerDefinition;
}
