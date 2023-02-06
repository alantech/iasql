import { Tab as ReactTab } from '@headlessui/react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Tab({
  titles,
  children,
  defaultIndex = 0,
}: {
  titles: string[];
  children: JSX.Element | JSX.Element[];
  defaultIndex?: number;
}) {
  return (
    <div className='w-full'>
      <ReactTab.Group defaultIndex={defaultIndex}>
        <ReactTab.List className='flex h-8 bg-blue-900/20'>
          {titles.map(category => (
            <ReactTab
              key={category}
              className={({ selected }) =>
                classNames(
                  'w-full py-1 text-xs font-medium dark:text-white',
                  selected ? 'bg-primary shadow' : 'dark:text-white hover:bg-primary',
                )
              }
            >
              {category}
            </ReactTab>
          ))}
        </ReactTab.List>
        <ReactTab.Panels className='overflow-auto w-full h-full'>{children}</ReactTab.Panels>
      </ReactTab.Group>
    </div>
  );
}
