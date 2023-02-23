import { useState, useEffect } from 'react';

import Connect from '@/components/Connect';
import { DatabaseManagement } from '@/components/DatabaseManagement/DatabaseManagement';
import Disconnect from '@/components/Disconnect';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader/Loader';
import Navbar from '@/components/Navbar';
import Query from '@/components/Query';
import SmallViewport from '@/components/SmallViewport';
import { align, Button, HBox } from '@/components/common';
import ErrorDialog from '@/components/common/ErrorDialog';
import { ActionType, useAppContext } from '@/components/providers/AppProvider';
import { useAppConfigContext } from '@/components/providers/ConfigProvider';
import { useAuth } from '@/hooks/useAuth';
import { DatabaseIcon, PlusSmIcon } from '@heroicons/react/outline';

export default function Main() {
  const { config } = useAppConfigContext();
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
  let innerWidth = 1024; // Server-side default
  const [isSmallViewport, showSmallViewport] = useState(innerWidth < MIN_WIDTH);

  useEffect(() => {
    if (innerWidth !== window.innerWidth) {
      innerWidth = window.innerWidth;
      showSmallViewport(innerWidth < MIN_WIDTH);
    }
    if (config && token && !latestVersion) {
      // Dispatch initial load
      dispatch({ token: token ?? '', action: ActionType.InitialLoad });

      // Set initial theme config
      if (!('theme' in localStorage)) {
        localStorage.setItem(
          'theme',
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
        );
      }
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      dispatch({ action: ActionType.SelectAppTheme, data: { theme: localStorage.getItem('theme') } });
    }
  }, [dispatch, token, latestVersion, config]);

  return (
    <>
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
    </>
  );
}
