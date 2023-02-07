import React from 'react';
import OriginalNavBarItem from '@theme-original/NavbarItem';
import { useLocation }  from '@docusaurus/router';

export default function NavbarItem(props) {
  const { label, type } = props;
  const { pathname } = useLocation();

  if (pathname.includes('blog')) {
    if (label === 'Blog') return null;
    if (type === 'docsVersionDropdown') return null;
  } else if (pathname.includes('docs')) {
    if (label === 'Docs') return null;
  } else if (pathname.includes('schema')) {
    if (label === 'Schema') return null;
    if (type === 'docsVersionDropdown') return null;
  } else {
    if (type === 'docsVersionDropdown') return null;
    if (label === 'Schema') return null;
    if (type === 'search') return null;
  }

  return (
    <>
      <OriginalNavBarItem {...props} />
    </>
  );
}