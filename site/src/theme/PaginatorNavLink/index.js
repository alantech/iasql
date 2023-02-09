import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
export default function PaginatorNavLink(props) {
  const {permalink, title, subLabel, isNext} = props;
  let newTitle = title;
  if (title == 'Modules') {
    // custom title for dynamic modules
    if (permalink.includes("/modules/")) {
      const items = permalink.split("/");
      newTitle = items[items.length-1];
    }
  }
  return (
    <Link
      className={clsx(
        'pagination-nav__link',
        isNext ? 'pagination-nav__link--next' : 'pagination-nav__link--prev',
      )}
      to={permalink}>
      {subLabel && <div className="pagination-nav__sublabel">{subLabel}</div>}
      <div className="pagination-nav__label">{newTitle}</div>
    </Link>
  );
}
