import { useEffect, useState } from 'react';

import { useAppConfigContext } from '@/components/providers/ConfigProvider';
import { useAuth0 } from '@auth0/auth0-react';

import * as Posthog from '../services/posthog';
import * as Sentry from '../services/sentry';

export function useAuth() {
  const [token, setToken] = useState(null) as unknown as [string | null, (arg0: string) => void];
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated, isLoading, user } = useAuth0();
  const { config } = useAppConfigContext();
  useEffect(() => {
    if (!config?.auth) {
      return setToken('noauth');
    }
    if (!isAuthenticated && !isLoading) {
      return void loginWithRedirect({ redirectUri: window.location.href } as any);
    }
    if (user && user.sub) {
      Sentry.identify(config, user.sub, user.email);
      Posthog.identify(config, user.sub);
    }
    const { audience, scope } = config?.auth?.authorizationParams;
    if (isAuthenticated && !token)
      getAccessTokenSilently({
        audience,
        scope,
      } as any).then((accessToken: any) => setToken(accessToken));
  }, [isAuthenticated, user, isLoading, getAccessTokenSilently, loginWithRedirect, token, setToken, config]);
  return {
    token,
    user,
  };
}
