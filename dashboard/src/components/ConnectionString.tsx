import config from '../config';
import { generateConnectionString } from '../services/connectDb';
import { Copyable, Label } from './common';

export default function ConnectionString({
  dbInfo,
}: {
  dbInfo: { user: string; password: string; id: string };
}) {
  return (
    <>
      <Label mode='info'>IaSQL Database is connected to your AWS Account</Label>
      <Copyable>{generateConnectionString(dbInfo, config.engine.pgForceSsl)}</Copyable>
      <Label mode='warn'>
        Copy your connection string. It will only be shown to you now. Be sure to save it!
      </Label>
    </>
  );
}
