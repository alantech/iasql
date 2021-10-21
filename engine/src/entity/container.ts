import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm'
import { EnvVariable } from './env_variable';
import { PortMapping } from './port_mapping';

@Entity()
export class Container {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;

  // TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
  @Column()
  image: string;

  @Column({
    default: false,
  })
  essential: boolean;

  @ManyToMany(() => PortMapping, { cascade: true, eager: true, })
  @JoinTable()
  portMappings?: PortMapping[];

  @ManyToMany(() => EnvVariable, { cascade: true, eager: true, })
  @JoinTable()
  environment?: EnvVariable[];
}
