import { useRef, useState } from 'react';

import { regions } from '@/services/connectDb';
import { LinkIcon } from '@heroicons/react/outline';

import ConnectionString from './ConnectionString';
import { Combobox, Input, Label, Step, VBox, Wizard } from './common';
import { ActionType, useAppContext } from './providers/AppProvider';

export default function Connect({ closable }: { closable: boolean }) {
  const { error, latestVersion, newDb, dispatch, token } = useAppContext();

  const [dbAlias, setDbAlias] = useState('');
  const [awsRegion, setAwsRegion] = useState(regions[14]); // default: us-east-2
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [stack, setStack] = useState(['createdb']);
  const isMakingDb = useRef(false);

  let nextEnabled = true;
  let backEnabled = false;
  const current = stack[stack.length - 1];
  // Check relevant state per step to determine automatic actions to perform, such as deciding if
  // the Next button should be enabled or not
  switch (current) {
    case 'createdb':
      nextEnabled = !!awsRegion && !!awsAccessKeyId && !!awsSecretAccessKey;
      break;
    case 'execdbcreate':
      nextEnabled = !!newDb;
      if (error) {
        dispatch({ action: ActionType.ShowConnect, data: { showConnect: false } });
      }
      if (!isMakingDb.current && !error && !newDb) {
        isMakingDb.current = true;
        dispatch({
          action: ActionType.NewDb,
          token,
          data: { dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, latestVersion },
        });
      }
      break;
    default:
      nextEnabled = true;
      break;
  }

  return (
    <Wizard
      icon={<LinkIcon className='h-6 w-6 text-primary' aria-hidden='true' />}
      title={'Connect IaSQL database to AWS account'}
      start='createdb'
      stack={stack}
      setStack={setStack}
      nextEnabled={nextEnabled}
      onNext={() => {
        switch (current) {
          case 'createdb':
            return 'execdbcreate';
          default:
            return 'createdb'; // Should never happen
        }
      }}
      backEnabled={backEnabled}
      closeable={closable}
      onClose={() => {
        dispatch({ action: ActionType.ShowConnect, data: { showConnect: false } });
        if (newDb) dispatch({ action: ActionType.ResetNewDb });
      }}
    >
      <Step id='createdb'>
        <Label>
          <b>Let&apos;s create a database to connect to your cloud account</b>
        </Label>
        <form className='mb-10'>
          <VBox>
            {/* TODO: WE MIGHT NEED TO CREATE AN INPUT COMPONENT */}
            <Label htmlFor='db-alias'>IaSQL Database Name (Optional)</Label>
            <Input
              type='text'
              name='db-alias'
              value={dbAlias}
              setValue={setDbAlias}
              validator={/^[a-zA-Z][a-zA-Z0-9-_]{0,127}$/}
              validationErrorMessage="IaSQL Database Name can contain only alphanumeric characters, hyphens and underscores. It must start with an alphabetical character and can't be longer than 128 characters"
            />
            {/* TODO: The `htmlFor` does not work with Combobox yet */}
            <Label htmlFor='credentials-region'>Default AWS Region</Label>
            {/* TODO: Remove this div wrapper somehow */}
            <div className='mt-1 flex rounded-md shadow-sm' style={{ zIndex: 999, maxHeight: '50em' }}>
              <Combobox data={regions} value={awsRegion} setValue={setAwsRegion} accessProp='name' />
            </div>
            <Label htmlFor='credentials-access-key-id'>AWS Access Key ID</Label>
            <Input
              required
              type='text'
              name='credentials-access-key-id'
              value={awsAccessKeyId}
              setValue={setAwsAccessKeyId}
            />
            <Label htmlFor='credentials-secret-access-key'>AWS Secret Access Key</Label>
            <Input
              required
              type='text'
              name='credentials-secret-access-key'
              value={awsSecretAccessKey}
              setValue={setAwsSecretAccessKey}
            />
          </VBox>
        </form>
      </Step>
      <Step
        id='execdbcreate'
        onFinish={() => {
          dispatch({ action: ActionType.ShowConnect, data: { showConnect: false } });
          dispatch({ action: ActionType.ResetNewDb });
        }}
      >
        {!newDb && <Label>Creating an IaSQL database connected to your AWS Account...</Label>}
        {!!newDb && <ConnectionString dbInfo={newDb} />}
      </Step>
    </Wizard>
  );
}
