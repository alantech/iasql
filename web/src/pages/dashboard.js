import React from 'react';
import { withAuthenticationRequired } from '@auth0/auth0-react';
import NewAccount from '../components/NewAccount';
import Layout from '@theme/Layout';


export function Profile() {
  // TODO add table with iasql instances this user has access to
  return (
    <Layout>
      <div className="container">
        {/*TODO make into a modal */ }
        <NewAccount />
      </div>
    </Layout>
  );
};

export default withAuthenticationRequired(Profile);