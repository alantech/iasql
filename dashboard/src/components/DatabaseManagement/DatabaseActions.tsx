import { useEffect } from 'react';

import { Menu } from '@headlessui/react';
import { CogIcon, DownloadIcon } from '@heroicons/react/outline';
import { PauseIcon, PlayIcon } from '@heroicons/react/solid';

import { ActionType, useAppContext } from '../../AppProvider';
import { align, Button, Dropdown, HBox, VBox } from '../common';

export function DatabaseActions() {
  const { editorContent, selectedDb, isRunningSql, dump, dispatch, token } = useAppContext();

  const handleDisconnect = () => {
    dispatch({ action: ActionType.ShowDisconnect, data: { show: true } });
  };

  const handleExport = (dbAlias: string, dataOnly: boolean) => {
    if (token) {
      dispatch({ token, action: ActionType.ExportDb, data: { dataOnly, dbAlias } });
    }
  };

  const handleRunSql = (db: any, isRunning: boolean, content: string) => {
    if (token) {
      dispatch({
        token,
        action: ActionType.RunSql,
        data: { db, isRunning, content },
      });
    }
  };

  useEffect(() => {
    function downloadDump(obj: any) {
      // https://akashmittal.com/react-download-files-button-click/
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(new Blob([obj as Blob], { type: 'application/octet-stream' }));
      link.download = `${selectedDb?.alias}.sql`;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        window.URL.revokeObjectURL(link as unknown as string);
      }, 200);
    }
    if (dump) {
      downloadDump(dump);
      dispatch({ action: ActionType.ExportedDb });
    }
  }, [dump, selectedDb?.alias, dispatch]);

  const buttonTitle = (
    <HBox alignment={align.start} id='database-settings'>
      <CogIcon className='mr-1 h-4 w-4' aria-hidden='true' />
      <span className='truncate'>Settings</span>
    </HBox>
  );

  return (
    <HBox alignment={align.end}>
      <HBox customStyles='md:justify-end'>
        <Dropdown buttonTitle={buttonTitle} color='tertiary' width='w-max' startPosition='right'>
          <VBox customStyles='p-2'>
            <Menu.Item>
              <HBox alignment={align.start} customStyles='p-1'>
                <Button look='link' onClick={() => handleExport(selectedDb.alias, true)}>
                  <DownloadIcon className='mr-1 h-4 w-4' aria-hidden='true' />
                  Export Data Only
                </Button>
              </HBox>
            </Menu.Item>
            <Menu.Item>
              <HBox alignment={align.start} customStyles='p-1'>
                <Button look='link' onClick={() => handleExport(selectedDb.alias, false)}>
                  <DownloadIcon className='mr-1 h-4 w-4' aria-hidden='true' />
                  Export Data With Schema
                </Button>
              </HBox>
            </Menu.Item>
          </VBox>
          <VBox customStyles='p-2'>
            <Menu.Item>
              <HBox alignment={align.start} customStyles='p-1'>
                <Button look='link' color='tertiary' onClick={handleDisconnect}>
                  <PauseIcon className='mr-1 h-4 w-4' aria-hidden='true' />
                  Disconnect
                </Button>
              </HBox>
            </Menu.Item>
          </VBox>
        </Dropdown>
      </HBox>
      <HBox alignment={align.end}>
        <Button
          look='iasql'
          onClick={() => handleRunSql(selectedDb, isRunningSql, editorContent)}
          disabled={!selectedDb?.alias || !!isRunningSql}
        >
          <PlayIcon className='h-4 w-4 mr-1' aria-hidden='true' />
          Run query
        </Button>
      </HBox>
    </HBox>
  );
}
