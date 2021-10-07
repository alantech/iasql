import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { Auth0Provider } from "@auth0/auth0-react";

// Default implementation, that you can customize
function Root({children}) {
  const {siteConfig} = useDocusaurusContext();
  {/* TODO generalize per environment */}
  const config = siteConfig.customFields.dev;
  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      redirectUri={config.redirectUri}
      >
      <>{children}</>
    </Auth0Provider>
  );
}

export default Root;