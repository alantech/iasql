import { useEffect, useState } from 'react';

import Loader from '@/components/Loader/Loader';
import Main from '@/components/Main';
import RageClickers from '@/components/RageClickers';
import { ErrorDialog } from '@/components/common';
import { AppProvider } from '@/components/providers/AppProvider';
import { useAppConfigContext } from '@/components/providers/ConfigProvider';
import { Auth0Provider } from '@auth0/auth0-react';

import * as Posthog from '../services/posthog';
import * as Sentry from '../services/sentry';

function handleRageClicking(setIsRageClicking: (arg0: boolean) => void) {
  const now = Date.now();
  const lastClick = localStorage.getItem('lastClick') ?? '0';
  const secondLastClick = localStorage.getItem('secondLastClick') ?? '0';
  localStorage.setItem('lastClick', now.toString());
  localStorage.setItem('secondLastClick', lastClick);
  if (now - parseInt(lastClick) < 500 && now - parseInt(secondLastClick) < 500) {
    setIsRageClicking(true);
  }
}

export default function App() {
  const { config, configError, telemetry, uid } = useAppConfigContext();
  const [isRageClicking, setIsRageClicking] = useState(false);

  useEffect(() => {
    if (telemetry !== undefined && telemetry === 'on') {
      Sentry.init(config);
      Posthog.init(config);
    }
    if (!config?.auth && uid) {
      Sentry.identify(config, uid);
      Posthog.identify(config, uid);
    }
  }, [telemetry, uid, config]);

  const body = (
    <AppProvider>
      <Main />
    </AppProvider>
  );

  const app = (
    <div
      className='min-h-full dark:text-white'
      onClick={() => {
        handleRageClicking(setIsRageClicking);
      }}
    >
      {configError && <ErrorDialog />}
      {isRageClicking && <RageClickers show={setIsRageClicking} />}
      {!config?.engine ? (
        <Loader />
      ) : (
        <>{config.auth ? <Auth0Provider {...config.auth}>{body}</Auth0Provider> : body}</>
      )}
    </div>
  );
  return app;
}
