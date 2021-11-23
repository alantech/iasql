import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm'

export enum CompatibilityValues {
  EC2 = "EC2",
  EXTERNAL = "EXTERNAL",
  FARGATE = "FARGATE"
}

@Entity()
export class Compatibility {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
    type: 'enum',
    enum: CompatibilityValues,
  })
  name?: CompatibilityValues;
}
