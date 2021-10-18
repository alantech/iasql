import React, { useState } from 'react';
import { useAuth0, withAuthenticationRequired } from '@auth0/auth0-react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Link from '@docusaurus/Link';

export function NewAccount() {
  const { siteConfig } = useDocusaurusContext();
  const { awsRegions, auth, backendUrl, } = siteConfig.customFields;
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [awsToken, setAwsToken] = useState('');
  const [awsSecret, setAwsSecret] = useState('');
  const [awsRegion, setAwsRegion] = useState('');
  const [dbAlias, setDbAlias] = useState('');

  const handleSubmit = async () => {
    const {audience, scope} = auth;

    const accessToken = await getAccessTokenSilently({
      // these params have to match the ones used to instantiate Auth0Provider
      // or this call fails with a horribly wrong error message of login_required
      // even though the user is logged in
      audience,
      scope,
    });

    await fetch(`${backendUrl}/v1/db/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        awsToken,
        awsSecret,
        dbAlias,
        awsRegion,
      }),
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
          <label>AWS Region:</label>
          <select value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)}>
            <option value=""> </option>
            {
              awsRegions.map(r => <option key={r} value={r}>{r}</option>)
            }
          </select>
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