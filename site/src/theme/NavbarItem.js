import React from 'react';
import OriginalNavBarItem from '@theme-original/NavbarItem';
import { useLocation }  from '@docusaurus/router';

export default function NavbarItem(props) {
  const { label, type } = props;
  const { pathname } = useLocation();

  if (pathname === '/') {
    if (label === 'Dashboard') return null;
    if (type === 'docsVersionDropdown') return null;
    if (label === 'Schema') return null;
    if (type === 'search') return null;
  }

  if (pathname.includes('blog')) {
    if (label === 'Dashboard') return null;
    if (label === 'Blog') return null;
    if (type === 'docsVersionDropdown') return null;
  }

  if (pathname.includes('docs')) {
    if (label === 'Docs') return null;
    if (label === 'Blog') return null;
  }

  if (pathname.includes('schema')) {
    if (label === 'Blog') return null;
    if (label === 'Schema') return null;
    if (type === 'docsVersionDropdown') return null;
  }

  return (
    <>
      <OriginalNavBarItem {...props} />
    </>
  );
}