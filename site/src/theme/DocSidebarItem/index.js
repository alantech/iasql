import React from 'react';
import DocSidebarItemCategory from '@theme/DocSidebarItem/Category';
import DocSidebarItemLink from '@theme/DocSidebarItem/Link';
import DocSidebarItemHtml from '@theme/DocSidebarItem/Html';
export default function DocSidebarItem({item, ...props}) {
  // if there is custom property fragment, modify the link
  if (item.customProps && ('fragment' in item.customProps)) {    
    item.label = item.customProps.label;
    if (item.customProps.fragment!="") 
    {
      // check if it has the fragment added or not
      if (!item.href.endsWith(item.customProps.fragment)) item.href = item.href + '#' +item.customProps.fragment;
    }
  }
  switch (item.type) {
    case 'category':
      return <DocSidebarItemCategory item={item} {...props} />;
    case 'html':
      return <DocSidebarItemHtml item={item} {...props} />;
    case 'link':
    default:
      return <DocSidebarItemLink item={item} {...props} />;
  }
}
