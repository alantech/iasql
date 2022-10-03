import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// TODO: should we add PEM regex constraint?
@Entity()
export class CertificateImport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  certificate: string;

  @Column()
  privateKey: string;

  @Column({ nullable: true })
  chain?: string;

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;
}
