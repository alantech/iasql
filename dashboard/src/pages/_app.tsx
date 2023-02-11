import '@/styles/globals.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Auth0Provider } from '@auth0/auth0-react';

import * as Posthog from '@/services/posthog';
import * as Sentry from '@/services/sentry';
import config from '@/config';
import reportWebVitals from '@/services/reportWebVitals';
import { AppProvider } from '@/components/AppProvider';

Posthog.init();
Sentry.init();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const isDarkMode = localStorage.theme === 'dark';
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const body = (
    <AppProvider>
      <Component {...pageProps} />
    </AppProvider>
  );
  return config.auth ? <Auth0Provider {...config.auth}>{body}</Auth0Provider> : body;
}
