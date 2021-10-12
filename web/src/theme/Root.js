import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Auth0Provider } from "@auth0/auth0-react";

// Default implementation, that you can customize
function Root({children}) {
  const {siteConfig} = useDocusaurusContext();
  {/* TODO generalize per environment */}
  const { auth, url } = siteConfig.customFields;
  return (
    <Auth0Provider
      domain={auth.domain}
      issuer={auth.domain}
      clientId={auth.clientId}
      redirectUri={`${url}/${auth.redirectPath}`}
      scope={auth.scope}
      audience={auth.audience}
      useRefreshTokens={true}
      >
      <>{children}</>
    </Auth0Provider>
  );
}

export default Root;