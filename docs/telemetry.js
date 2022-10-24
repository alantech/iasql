import Amplitude from 'amplitude-js';
import Hotjar from '@hotjar/browser';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

const AMP_KEY = 'c9d876059e7c9a83e44dcef855e77f48';
const HOTJAR_SITE_ID = 2927368;
const HOTJAR_VERSION = 6;

function addDeviceId() {
  const deviceId = Amplitude.getInstance().options.deviceId;
  // TheButton href^= matches on the beginning of the href
  document.querySelectorAll("[href^='https://app.iasql.com/#/button/']")
    .forEach(n => n.href += `?amp_device_id=${deviceId}`);
  // Dashboard
  document.querySelectorAll("[href='https://app.iasql.com']")
    .forEach(n => n.href = `https://app.iasql.com?amp_device_id=${deviceId}`);
  // Docs
  document.querySelectorAll("[href='https://docs.iasql.com']")
    .forEach(n => n.href = `https://docs.iasql.com?amp_device_id=${deviceId}`);
  // Blog
  document.querySelectorAll("[href='https://blog.iasql.com']")
  .forEach(n => n.href = `https://blog.iasql.com?amp_device_id=${deviceId}`);
  // Landing page
  document.querySelectorAll("[href='https://iasql.com']")
    .forEach(n => n.href = `https://iasql.com?amp_device_id=${deviceId}`);
}

export function onRouteDidUpdate({location, previousLocation}) {
  // Don't execute if we are still on the same page; the lifecycle may be fired
  // because the hash changes (e.g. when navigating between headings)
  if (location.pathname !== previousLocation?.pathname) {
    Amplitude.getInstance().logEvent("DOCS", {
      route: location.pathname,
    });
    addDeviceId();
  }
}

// browser only
if (ExecutionEnvironment.canUseDOM) {
  // https://developers.amplitude.com/docs/advanced-settings#cross-domain-tracking-javascript
  Amplitude.getInstance().init(AMP_KEY, null, {includeReferrer: true, includeUtm: true, deviceIdFromUrlParam: true}, addDeviceId);
  Amplitude.getInstance().logEvent("DOCS", {
    route: document.location.pathname,
  });
  Hotjar.init(HOTJAR_SITE_ID, HOTJAR_VERSION);
}