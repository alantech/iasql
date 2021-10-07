import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './index.module.css';

function Header() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title}`}
      description={`${siteConfig.description}`}>
      <Header />
      <main>
        <h1>Schema</h1>
      </main>
    </Layout>
  );
}