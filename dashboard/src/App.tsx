import { useState, useEffect } from 'react';

import { DatabaseIcon, PlusSmIcon } from '@heroicons/react/outline';

import { ActionType, useAppContext } from './AppProvider';
import Connect from './components/Connect';
import { DatabaseManagement } from './components/DatabaseManagement/DatabaseManagement';
import Disconnect from './components/Disconnect';
import EmptyState from './components/EmptyState';
import Loader from './components/Loader/Loader';
import Navbar from './components/Navbar';
import Query from './components/Query';
import SmallViewport from './components/SmallViewport';
import { align, Button, HBox } from './components/common';
import ErrorDialog from './components/common/ErrorDialog';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const {
    dispatch,
    databases,
    error: appError,
    shouldShowDisconnect,
    shouldShowConnect,
    latestVersion,
  } = useAppContext();
  const { user, token } = useAuth();
  const MIN_WIDTH = 640; // measure in px
  const [isSmallViewport, showSmallViewport] = useState(window.innerWidth < MIN_WIDTH);

  useEffect(() => {
    if (token && !latestVersion) {
      dispatch({ token: token ?? '', action: ActionType.InitialLoad });
    }
  }, [dispatch, token, latestVersion]);

  return (
    <div className='min-h-full dark:text-white'>
      {/* Modals */}
      {isSmallViewport && <SmallViewport showSmallViewport={showSmallViewport} />}
      {appError && <ErrorDialog />}
      {token && shouldShowConnect && <Connect closable={true} />}
      {token && shouldShowDisconnect && <Disconnect />}
      <Navbar userPic={user?.picture ?? '' /* TODO: Default pic? */} />
      {!latestVersion ? (
        <Loader />
      ) : (
        <>
          <main>
            {!databases?.length ? (
              <div className='max-w-full mx-auto pt-4 sm:px-4 lg:px-6'>
                <EmptyState>
                  <p>No connected accounts</p>
                  <p>Get started by connecting an account</p>
                  <HBox customStyles='mt-2'>
                    <Button
                      look='iasql'
                      onClick={() => {
                        dispatch({ action: ActionType.ShowConnect, data: { showConnect: true } });
                      }}
                    >
                      <HBox alignment={align.around}>
                        <DatabaseIcon className='w-5 h-5' aria-hidden='true' />
                        <PlusSmIcon className='w-5 h-5 mr-1 ' aria-hidden='true' />
                        Connect Account
                      </HBox>
                    </Button>
                  </HBox>
                </EmptyState>
              </div>
            ) : (
              <>
                <div className='max-w-full mx-auto pt-4 sm:px-4 lg:px-6'>
                  <DatabaseManagement />
                </div>
                <div className='max-w-full mx-auto py-2 sm:px-4 lg:px-6'>
                  <Query />
                </div>
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}
