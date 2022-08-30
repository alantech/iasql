import { Entity, Column, PrimaryGeneratedColumn, AfterLoad, AfterInsert, AfterUpdate } from 'typeorm';

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
