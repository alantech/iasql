import { useEffect } from 'react';

import { Menu } from '@headlessui/react';
import { DatabaseIcon, PlusSmIcon } from '@heroicons/react/outline';

import { ActionType, useAppContext } from '../../AppProvider';
import { useQueryParams } from '../../hooks/useQueryParams';
import { align, Button, Dropdown, HBox, Spinner, VBox } from '../common';
import { DatabaseStatus } from './DatabaseStatus';

export function DatabaseSelection() {
  const { dispatch, databases, selectedDb, token } = useAppContext();
  // Query params
  const queryParams = useQueryParams();
  const dbAliasFromUrl = queryParams.get('alias') ?? null;

  useEffect(() => {
    const dbFromUrl = databases.find(database => database.alias === dbAliasFromUrl);
    const db = dbFromUrl ?? selectedDb ?? databases[0];
    dispatch({ action: ActionType.SelectDb, data: { db } });
    if (selectedDb) {
      dispatch({ token, action: ActionType.RunAutocompleteSql, data: { dbAlias: db?.alias } });
    }
  }, [databases, dispatch, dbAliasFromUrl, token, selectedDb]);

  const buttonTitle = (
    <HBox alignment={align.start} id='database-selection'>
      <DatabaseIcon className='mr-1 h-4 w-4' aria-hidden='true' />
      <span className='truncate'>{selectedDb?.alias}</span>
    </HBox>
  );

  return (
    <HBox>
      {!selectedDb ? (
        <Spinner />
      ) : (
        <Dropdown buttonTitle={buttonTitle} buttonTitleLook='outline' color='primary'>
          <VBox id='db-selection-list' alignment={align.start} customStyles='h-50vh overflow-y-scroll p-2'>
            {databases.map((db: any) => (
              <Menu.Item key={db.alias}>
                <HBox
                  customStyles='p-2 cursor-pointer hover:text-primary'
                  alignment={align.between}
                  onClick={() => dispatch({ action: ActionType.SelectDb, data: { db } })}
                >
                  <span className='mr-1'>{db?.alias}</span>
                  <DatabaseStatus db={db} />
                </HBox>
              </Menu.Item>
            ))}
          </VBox>
          <VBox customStyles='p-2'>
            <Menu.Item>
              <HBox customStyles='items-center'>
                <Button
                  look='link'
                  color='primary'
                  onClick={() => {
                    dispatch({ action: ActionType.ShowConnect, data: { showConnect: true } });
                  }}
                >
                  <DatabaseIcon className='h-4 w-4' aria-hidden='true' />
                  <PlusSmIcon className='mr-1 h-4 w-4' aria-hidden='true' />
                  Connect account
                </Button>
              </HBox>
            </Menu.Item>
          </VBox>
        </Dropdown>
      )}
    </HBox>
  );
}
