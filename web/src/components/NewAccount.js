import React, { useState } from 'react';
import { useAuth0, withAuthenticationRequired } from '@auth0/auth0-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';

export function NewAccount() {
  const { siteConfig } = useDocusaurusContext();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [awsToken, setAwsToken] = useState('');
  const [awsSecret, setAwsSecret] = useState('');
  const [dbAlias, setDbAlias] = useState('');

  const handleSubmit = async () => {
    const {auth, backendUrl} = siteConfig.customFields;
    const {audience, scope} = auth;

    const accessToken = await getAccessTokenSilently({
      // these params have to match the ones used to instantiate Auth0Provider
      // or this call fails with a horribly wrong error message of login_required
      // even though the user is logged in
      audience,
      scope,
    });

    // TODO pass in the aws creds
    const resp = await fetch(`${backendUrl}/v1/db/create/${dbAlias}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        //'Content-Type': 'application/json',
      },
      // body: JSON.stringify({
      //   'awsToken': awsToken,
      //   'awsSecret': awsSecret
      // }),
    });
  }

  return (
    isAuthenticated && (
      <div className="container">
        <form>
          <label>AWS Access Token:</label>
          <input type="text" id="awsToken" name="awsToken" value={awsToken} onChange={(e) => setAwsToken(e.target.value)}/>
          <label>AWS Secret:</label>
          <input type="text" id="awsSecret" name="awsSecret" value={awsSecret} onChange={(e) => setAwsSecret(e.target.value)}/>
          <label>DB Alias:</label>
          <input type="text" id="dbAlias" name="dbAlias" value={dbAlias} onChange={(e) => setDbAlias(e.target.value)}/>
        </form>
        <div className="row">
          <Link
            className="button button--secondary button--lg"
            onClick={async() => { await handleSubmit()}}>
            Save
          </Link>
        </div>
      </div>
    )
  );
};

export default withAuthenticationRequired(NewAccount);