import { generateConnectionString } from '../services/connectDb';
import { Copyable, Label } from './common';
import { useAppConfigContext } from './providers/ConfigProvider';

export default function ConnectionString({
  dbInfo,
}: {
  dbInfo: { user: string; password: string; id: string };
}) {
  const { config } = useAppConfigContext();
  return (
    <>
      <Label mode='info'>IaSQL Database is connected to your AWS Account</Label>
      <Copyable customClasses='ph-no-capture'>
        {generateConnectionString(dbInfo, config?.engine.pgHost, config?.engine.pgForceSsl)}
      </Copyable>
      <Label mode='warn'>
        Copy your connection string. It will only be shown to you now. Be sure to save it!
      </Label>
    </>
  );
}
