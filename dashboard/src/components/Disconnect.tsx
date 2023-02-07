import { useState } from 'react';

import { PauseIcon } from '@heroicons/react/outline';

import { ActionType, useAppContext } from '../AppProvider';
import { Button, Modal, Label, Spinner } from './common';

export default function Disconnect() {
  const { dispatch, token, selectedDb } = useAppContext();

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  return (
    <Modal
      title='Disconnect account and remove database'
      icon={<PauseIcon className='h-6 w-6 text-gray-600' aria-hidden='true' />}
      onClose={() => dispatch({ action: ActionType.ShowDisconnect, data: { show: false } })}
      closeable={!isDisconnecting}
    >
      {isDisconnecting ? (
        <>
          <Label>
            Disconnecting IaSQL database <b>{selectedDb?.alias}</b>. None of the cloud resources in the
            account will be deleted.
          </Label>
          <Spinner />
        </>
      ) : (
        <>
          <Label>
            Are you sure you want to disconnect this account from IaSQL and remove the{' '}
            <b>{selectedDb?.alias}</b> database? None of the cloud resources in the account will be deleted.
          </Label>
          <Button
            id='disconnect-modal'
            onClick={() => {
              dispatch({
                action: ActionType.DisconnectDb,
                token,
                data: {
                  dbAlias: selectedDb?.alias,
                },
              });
              setIsDisconnecting(true);
            }}
          >
            Disconnect
          </Button>
        </>
      )}
    </Modal>
  );
}
