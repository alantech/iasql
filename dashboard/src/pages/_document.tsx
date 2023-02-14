import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang='en'>
      <Head>
        <link rel="icon" href="/logo-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Cloud infrastructure as a PostgreSQL DB"
        />
        <link rel="apple-touch-icon" href="/logo-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <title>IaSQL Dashboard</title>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
