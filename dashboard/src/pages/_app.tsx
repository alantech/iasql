import { useEffect } from 'react';

import type { AppProps } from 'next/app';
import Head from 'next/head';

import { AppProvider } from '@/components/AppProvider';
import config from '@/config';
import * as Posthog from '@/services/posthog';
import reportWebVitals from '@/services/reportWebVitals';
import * as Sentry from '@/services/sentry';
import '@/styles/globals.css';
import { Auth0Provider } from '@auth0/auth0-react';

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

  const app = (
    <>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='theme-color' content='#000000' />
        <meta name='description' content='Cloud infrastructure as a PostgreSQL DB' />
        <title>IaSQL Dashboard</title>
      </Head>
      {config.auth ? <Auth0Provider {...config.auth}>{body}</Auth0Provider> : body}
    </>
  );
  return app;
}
