import React from 'react';
import Layout from '@theme/Layout';

export default function Schema() {
  return (
    <Layout title="Schema" description="Cloud infrastructure as data in PostgreSQL" disableSwitch={true}>
      <iframe width="100%" height="1000" src="https://dbdocs.io/iasql/iasql" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </Layout>
  );
}