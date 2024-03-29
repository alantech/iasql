import type { AppProps } from 'next/app';
import Head from 'next/head';

import { AppConfigProvider } from '@/components/providers/ConfigProvider';
import reportWebVitals from '@/services/reportWebVitals';
import '@/styles/globals.css';

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

export default function App({ Component, pageProps }: AppProps) {
  const app = (
    <>
      <Head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='theme-color' content='#000000' />
        <meta name='description' content='Cloud infrastructure as a PostgreSQL DB' />
        <title>IaSQL Dashboard</title>
      </Head>
      <AppConfigProvider>
        <Component {...pageProps} />
      </AppConfigProvider>
    </>
  );
  return app;
}
