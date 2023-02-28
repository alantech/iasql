import { useState, Children } from 'react';

export default function Copyable({ children, sensitive }: { children: any[] | any; sensitive?: boolean }) {
  const child = Children.toArray(children)[0];
  if (typeof child !== 'string') throw new Error('Copyable only works with text');
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <p
      className={
        (sensitive ? 'ph-no-capture ' : '') + 'mt-1 max-w-2xl text-sm cursor-pointer text-primary break-words'
      }
      onClick={() => {
        setShowTooltip(true);
        navigator.clipboard.writeText(child);
        setTimeout(() => setShowTooltip(false), 1000);
      }}
    >
      {showTooltip ? (
        <span className='z-50 inline-block absolute mt-6 tooltip bg-white dark:bg-gray-800 text-sm rounded shadow-lg px-2 text-gray-900 dark:text-gray-100'>
          Copied
        </span>
      ) : (
        ''
      )}
      {child}
    </p>
  );
}
