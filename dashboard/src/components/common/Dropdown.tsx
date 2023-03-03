import React, { forwardRef, Fragment } from 'react';

import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/outline';

import { Button, HBox, align } from '.';

const DropdownTitleButton = forwardRef(
  (
    {
      children,
      customColor,
      look,
      onClick,
      isDisabled = false,
    }: {
      look?: 'iasql' | 'cancel' | 'link' | 'outline';
      customColor?: 'primary' | 'secondary' | 'tertiary';
      children: JSX.Element[];
      onClick: (...args: any) => any;
      isDisabled: boolean;
    },
    ref,
  ) => (
    <Button
      ref={ref as React.Ref<HTMLButtonElement>}
      color={customColor}
      customClassName='w-full'
      look={look}
      onClick={onClick}
      disabled={isDisabled}
    >
      {children}
    </Button>
  ),
);
DropdownTitleButton.displayName = 'DropdownTitleButton';

export default function Dropdown({
  buttonTitle,
  children,
  color,
  width = 'w-full',
  startPosition = 'left',
  buttonTitleLook,
  isDisabled = false,
}: {
  buttonTitle: JSX.Element;
  buttonTitleLook?: 'iasql' | 'cancel' | 'link' | 'outline';
  children: JSX.Element | JSX.Element[];
  color?: 'primary' | 'secondary' | 'tertiary';
  width?: string;
  startPosition?: 'right' | 'left';
  isDisabled?: boolean;
}) {
  return (
    <Menu as='div' className={`relative inline-block text-left ${width}`}>
      <div>
        <Menu.Button
          as={DropdownTitleButton}
          customColor={color}
          look={buttonTitleLook}
          isDisabled={isDisabled}
        >
          <HBox alignment={align.between}>
            <span className='truncate'>{buttonTitle}</span>
            <ChevronDownIcon className='ml-1 h-4 w-4' aria-hidden='true' />
          </HBox>
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter='transition ease-out duration-100'
        enterFrom='transform opacity-0 scale-95'
        enterTo='transform opacity-100 scale-100'
        leave='transition ease-in duration-75'
        leaveFrom='transform opacity-100 scale-100'
        leaveTo='transform opacity-0 scale-95'
      >
        <Menu.Items
          className={`absolute ${startPosition}-0 mt-2 w-max z-10 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-md bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none`}
        >
          {children}
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
