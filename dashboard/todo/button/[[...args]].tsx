import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router'

import { CloudUploadIcon } from '@heroicons/react/solid';

import { ActionType, useAppContext } from '@/components/AppProvider';
import { useAuth } from '@/hooks/useAuth';
import { regions } from '@/services/connectDb';
import ConnectionString from '@/components/ConnectionString';
import Loader from '@/components/Loader/Loader';
import Navbar from '@/components/Navbar';
import { Combobox, ErrorDialog, Input, Label, Option, Radio, Step, VBox, Wizard } from '@/components/common';

export default function TheButton() {
  const { dispatch, databases, newDb, latestVersion, error } = useAppContext();

  const params = useRouter().query;
  const { token, user } = useAuth();

  const [selectedDbAlias, setSelectedDbAlias] = useState('');
  const [dbAlias, setDbAlias] = useState('');
  const [awsRegion, setAwsRegion] = useState(regions[14]); // default: us-east-2
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [stack, setStack] = useState(['start']);
  const isMakingDb = useRef(false);

  useEffect(() => {
    if (token && !latestVersion) {
      dispatch({ token: token ?? '', action: ActionType.InitialLoad });
    }
  }, [dispatch, token, latestVersion]);

  useEffect(() => {
    if (token) {
      dispatch({
        action: ActionType.TrackEvent,
        token,
        data: { trackEventName: 'THE_BUTTON_LOGIN', buttonAlias: params.title, queryToRun: params.query },
      });
    }
  }, [token, params.title, params.query, dispatch]);

  const onFinishFn = (db: string) => {
    const currentStep = stack[stack.length - 1];
    if (token && currentStep === 'execdbcreate') {
      dispatch({
        action: ActionType.TrackEvent,
        token,
        data: {
          trackEventName: 'THE_BUTTON_NEW_DB',
          dbAlias: db,
          buttonAlias: params.title,
          queryToRun: params.query,
        },
      });
    }
    if (token && currentStep === 'selectdb') {
      dispatch({
        action: ActionType.TrackEvent,
        token,
        data: {
          trackEventName: 'THE_BUTTON_EXISTING_DB',
          dbAlias: db,
          buttonAlias: params.title,
          queryToRun: params.query,
        },
      });
    }
    window.location.href = `/#/?alias=${db}&sql=${encodeURI((params.query ?? '') as string)}`;
  };
  let nextEnabled = true;
  let current = stack[stack.length - 1];
  // Automatically transition from the start state to either the DB selector or creator based on
  // the current state of their account
  if (current === 'start' && latestVersion) {
    current = databases?.length > 0 ? 'selectdb' : 'createdb';
    stack.pop();
    stack.push(current);
  }
  // Check relevant state per step to determine automatic actions to perform, such as deciding if
  // the Next button should be enabled or not
  switch (current) {
    case 'createdb':
      nextEnabled = !!awsRegion && !!awsAccessKeyId && !!awsSecretAccessKey;
      break;
    case 'execdbcreate':
      nextEnabled = !!newDb;
      if (!newDb && !isMakingDb.current && token) {
        isMakingDb.current = true;
        dispatch({
          action: ActionType.NewDb,
          token,
          data: { dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, latestVersion },
        });
      }
      break;
    case 'selectdb':
      nextEnabled = !!selectedDbAlias;
      break;
    default:
      nextEnabled = true;
      break;
  }

  return (
    <div className='min-h-full dark:text-white'>
      {error && <ErrorDialog />}
      <Navbar userPic={user?.picture ?? ''} />
      {!token && !latestVersion ? (
        <Loader />
      ) : (
        <>
          <Wizard
            icon={<CloudUploadIcon className='h-6 w-6 text-primary' aria-hidden='true' />}
            title={(params.title ?? '') as string}
            start='start'
            stack={stack}
            setStack={setStack}
            nextEnabled={nextEnabled}
            onNext={() => {
              switch (current) {
                case 'start':
                  return !!databases && databases.length > 0 ? 'selectdb' : 'createdb';
                case 'createdb':
                  return 'execdbcreate';
                case 'execdbcreate':
                  return 'runquery';
                case 'selectdb':
                  return selectedDbAlias === '000CREATE000' ? 'createdb' : 'runquery';
                default:
                  return 'start'; // Should never happen
              }
            }}
          >
            <Step id='start'>
              <Label>Account loading...</Label>
            </Step>
            <Step id='createdb'>
              <Label>
                <b>Let's create a database to connect to your cloud account</b>
              </Label>
              <form>
                <VBox>
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
            <Step id='execdbcreate' onFinish={() => onFinishFn(dbAlias)}>
              {!newDb && <Label>Creating an IaSQL database connected to your AWS Account...</Label>}
              {!!newDb && <ConnectionString dbInfo={newDb} />}
            </Step>
            <Step
              id='selectdb'
              onFinish={selectedDbAlias !== '000CREATE000' ? () => onFinishFn(selectedDbAlias) : undefined}
            >
              <Label>Choose the IaSQL DB you wish to use</Label>
              <Radio selected={selectedDbAlias} setSelected={setSelectedDbAlias}>
                {databases.map((db: any) => (
                  <Option key={db.alias} name={db.alias} value={db.alias}>
                    <strong>{db.alias}</strong> - <em>{db.region}</em>
                  </Option>
                ))}
                <Label>-- Or --</Label>
                <Option key='000CREATE000' name='000CREATE000' value='000CREATE000'>
                  Create a new Database
                </Option>
              </Radio>
            </Step>
          </Wizard>
        </>
      )}
    </div>
  );
}
