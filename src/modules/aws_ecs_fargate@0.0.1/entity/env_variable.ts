import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { AwsContainerDefinition } from '.'

@Entity()
export class EnvVariable {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column()
  value: string;

  @ManyToOne(() => AwsContainerDefinition)
  @JoinColumn({
    name: 'container_definition_id',
  })
  containerDefinition: AwsContainerDefinition;
}
