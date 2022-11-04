import React from 'react';
import Consent from './Consent.js';

export default function Root({children}) {
  const rndr = [...children, <Consent/>];
  return <>{rndr}</>;
}