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
import { useRuntimeConfigContext } from '@/components/providers/RuntimeConfigProvider';
import config from '@/config';
import { throwError } from '@/config/config';
import { useAuth } from '@/hooks/useAuth';
import { DatabaseIcon, PlusSmIcon } from '@heroicons/react/outline';

import * as Posthog from '../services/posthog';
import * as Sentry from '../services/sentry';

export default function App() {
  const { telemetry, uid } = useRuntimeConfigContext();
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
    if (telemetry !== undefined && telemetry === 'on') {
      Sentry.init();
      Posthog.init();
      if (!config.auth && uid !== undefined && uid === 'nouid') {
        throwError('No uid found');
      } else if (!config.auth && uid !== undefined && uid !== 'nouid') {
        Sentry.identify(uid);
        Posthog.identify(uid);
      }
    }
  }, [telemetry, uid]);

  useEffect(() => {
    if (innerWidth !== window.innerWidth) {
      innerWidth = window.innerWidth;
      showSmallViewport(innerWidth < MIN_WIDTH);
    }
    if (token && !latestVersion) {
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
