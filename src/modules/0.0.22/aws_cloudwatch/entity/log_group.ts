import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['logGroupName', 'region'], { unique: true })
export class LogGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  logGroupName: string;

  @Column({
    nullable: true,
  })
  logGroupArn?: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  creationTime?: Date;

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;
}
