
import { ActionType, useAppContext } from '@/components/providers/AppProvider';
import { Menu } from '@headlessui/react';
import { CogIcon } from '@heroicons/react/outline';
import { PauseIcon, PlayIcon } from '@heroicons/react/solid';

import { align, Button, Dropdown, HBox, VBox } from '../common';

export function DatabaseActions() {
  const { editorSelectedTab, editorTabs, selectedDb, dispatch, token } = useAppContext();

  const handleDisconnect = () => {
    dispatch({ action: ActionType.ShowDisconnect, data: { show: true } });
  };

  const handleRunSql = (db: any, content: string, tabIdx: number) => {
    if (token) {
      dispatch({
        token,
        action: ActionType.RunSql,
        data: { db, content, tabIdx },
      });
    }
  };

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
          <VBox customClasses='p-2'>
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
          onClick={() =>
            handleRunSql(selectedDb, editorTabs?.[editorSelectedTab]?.content, editorSelectedTab)
          }
          disabled={!selectedDb?.alias || editorTabs?.[editorSelectedTab]?.isRunning}
        >
          <PlayIcon className='h-4 w-4 mr-1' aria-hidden='true' />
          Run query
        </Button>
      </HBox>
    </HBox>
  );
}
