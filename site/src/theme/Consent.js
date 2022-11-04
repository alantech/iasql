import React, { useState } from 'react';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

export default function CookieBanner() {
  if (!ExecutionEnvironment.canUseDOM || !window.posthog || !window.posthog.has_opted_out_capturing || !window.posthog.has_opted_in_capturing) return <></>;

  const [showBanner, setShowBanner] = useState(!window.posthog.has_opted_out_capturing() && !window.posthog.has_opted_in_capturing());

  if (!showBanner) return <></>;
  
  const acceptCookies = () => { 
    window.posthog.opt_in_capturing();
    setShowBanner(false);
  };

  const declineCookies = () => {
    window.posthog.opt_out_capturing();
    setShowBanner(false);
  };

  return (
    <div className='banner'>
      <p className='banner-text'>
        We use tracking cookies to understand how you use the product 
        and help us improve it.
        Please accept cookies to help us improve.
      </p>
      <div className='banner-buttons'>
        <button className='banner-button clean-btn' type="button" onClick={acceptCookies}>
          Accept Cookies
        </button>
        <button className='banner-button clean-btn' type="button" onClick={declineCookies}>
          Decline Cookies
        </button>
      </div>
    </div>
  );
}