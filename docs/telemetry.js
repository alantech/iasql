import amplitude from 'amplitude-js';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

const amplitudeKey = 'c9d876059e7c9a83e44dcef855e77f48';

function addDeviceId() {
  const deviceId = amplitude.getInstance().options.deviceId;
  document.querySelectorAll("[href='https://app.iasql.com']")
    .forEach(n => n.href = `https://app.iasql.com?amp_device_id=${deviceId}`);
  document.querySelectorAll("[href='https://blog.iasql.com']")
    .forEach(n => n.href = `https://blog.iasql.com?amp_device_id=${deviceId}`);
  document.querySelectorAll("[href='https://iasql.com']")
    .forEach(n => n.href = `https://iasql.com?amp_device_id=${deviceId}`);
}

export function onRouteDidUpdate({location, previousLocation}) {
  // Don't execute if we are still on the same page; the lifecycle may be fired
  // because the hash changes (e.g. when navigating between headings)
  if (location.pathname !== previousLocation?.pathname) {
    amplitude.getInstance().logEvent("DOCS", {
      route: location.pathname,
    });
    addDeviceId();
  }
}

// browser only
if (ExecutionEnvironment.canUseDOM) {
  // https://developers.amplitude.com/docs/advanced-settings#cross-domain-tracking-javascript
  amplitude.getInstance().init(amplitudeKey, null, {includeReferrer: true, includeUtm: true, deviceIdFromUrlParam: true}, addDeviceId);
  amplitude.getInstance().logEvent("DOCS", {
    route: document.location.pathname,
  });
}