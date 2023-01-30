import React from 'react';
import Link from '@docusaurus/Link';

// customize link function
export default function MDXA(props) {
  // if href starts with iasql.com/docs, we remove it
  const newProps = {...props};
  newProps.href = newProps.href.replace("https://iasql.com/docs", "/docs");
  return <Link {...newProps} />;
}
