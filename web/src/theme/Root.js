import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Auth0Provider } from "@auth0/auth0-react";

// Default implementation, that you can customize
function Root({children}) {
  const {siteConfig} = useDocusaurusContext();
  {/* TODO generalize per environment */}
  const authConfig = siteConfig.customFields.auth;
  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      redirectUri={authConfig.redirectUri}
      >
      <>{children}</>
    </Auth0Provider>
  );
}

export default Root;