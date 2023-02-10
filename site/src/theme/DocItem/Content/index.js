import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/theme-common/internal';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';

/**
 Title can be declared inside md content or declared through
 front matter and added manually. To make both cases consistent,
 the added title is added under the same div.markdown block
 See https://github.com/facebook/docusaurus/pull/4882#issuecomment-853021120

 We render a "synthetic title" if:
 - user doesn't ask to hide it with front matter
 - the markdown content does not already contain a top-level h1 heading
*/
function useSyntheticTitle() {
  const {metadata, frontMatter, contentTitle} = useDoc();
  const shouldRender =
    !frontMatter.hide_title && typeof contentTitle === 'undefined';
  if (!shouldRender) {
    return null;
  }
  return metadata.title;
}

// custom function to render type badge
function renderType(id) {
  if (id.startsWith("modules/") && id!="modules/index") {

    // get type from url and class  
    let type, color;
    if (id.includes("/tables/")) {
      if (id.includes("_rpcs_")) {
        type = "Function";
        color = "95CE3D";  
      } else {
        type = "Table";
        color = "3D95CE";  
      }
    }
    else if (id.includes("/enums/")) {
      type = "Enum";
      color = "CD3C94";
    }
    else if (id.includes("/functions/")) {
      type = "Function";
      color = "95CE3D";
    } else {
      type = "Module";
      color = "CE3D3D";
    }

    if (type && color) {
      const image = `https://img.shields.io/static/v1?label=&message=${type}&color=${color}&style=for-the-badge`;
      return <span class="padding-left--lg"><img src={image} /></span>;
    } else return <></>;
  }
}

export default function DocItemContent({children}) {
  const syntheticTitle = useSyntheticTitle();
  const {metadata} = useDoc();
  const badge = renderType(metadata.id);

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {syntheticTitle && (
        <header>
          <Heading as="h1"><span>{syntheticTitle}</span>{badge}</Heading>
        </header>
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
