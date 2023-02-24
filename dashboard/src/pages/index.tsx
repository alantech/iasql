import { useEffect } from 'react';

import Loader from '@/components/Loader/Loader';
import Main from '@/components/Main';
import { ErrorDialog } from '@/components/common';
import { AppProvider } from '@/components/providers/AppProvider';
import { useAppConfigContext } from '@/components/providers/ConfigProvider';
import { Auth0Provider } from '@auth0/auth0-react';

import * as Posthog from '../services/posthog';
import * as Sentry from '../services/sentry';

export default function App() {
  const { config, configError, telemetry, uid } = useAppConfigContext();

  useEffect(() => {
    console.log(config?.auth);
    
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
    <div className='min-h-full dark:text-white'>
      {configError && <ErrorDialog />}
      {!config?.engine ? (
        <Loader />
      ) : (
        <>{config.auth ? <Auth0Provider {...config.auth}>{body}</Auth0Provider> : body}</>
      )}
    </div>
  );
  return app;
}
