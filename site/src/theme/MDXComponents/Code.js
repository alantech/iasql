import React, {isValidElement} from 'react';
import CodeBlock from '@theme/CodeBlock';
export default function MDXCode(props) {
  const inlineElements = [
    'a',
    'abbr',
    'b',
    'br',
    'button',
    'cite',
    'code',
    'del',
    'dfn',
    'em',
    'i',
    'img',
    'input',
    'ins',
    'kbd',
    'label',
    'object',
    'output',
    'q',
    'ruby',
    's',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
    'var',
    'wbr',
  ];
  const shouldBeInline = React.Children.toArray(props.children).every(
    (el) =>
      (typeof el === 'string' && !el.includes('\n')) ||
      (isValidElement(el) && inlineElements.includes(el.props?.mdxType)),
  );
  return shouldBeInline ? <code {...props} /> : <CodeBlock {...props} />;
}
