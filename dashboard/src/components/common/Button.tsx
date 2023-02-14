import React, { forwardRef } from 'react';

// todo: DRY this up
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export const Button = forwardRef(
  (
    {
      disabled = false,
      look,
      type = 'button',
      onClick,
      id,
      children,
      color = 'primary',
      customClassName = '',
    }: {
      disabled?: boolean;
      look?: 'iasql' | 'cancel' | 'link' | 'outline';
      type?: 'button' | 'submit';
      color?: 'primary' | 'secondary' | 'tertiary';
      onClick?: (e?: any) => void;
      id?: string;
      children: any[] | any;
      customClassName?: string;
    },
    ref: React.Ref<HTMLButtonElement>,
  ) => {
    const commonClasses = 'inline-flex justify-center items-center text-md font-medium py-2 px-4 truncate';
    // This fake component exists solely to make sure all possible tailwind class names are actually generated and isn't used
    /* tslint:disable-next-line no-unused-expression */
    <button className='bg-primary bg-secondary bg-tertiary text-primary text-secondary text-tertiary border-primary border-secondary border-tertiary hover:bg-primary hover:bg-secondary hover:bg-tertiary'>
      FAKE
    </button>;
    const disabledClassName =
      {
        iasql:
          'text-white bg-gradient-to-bl from-primary to-secondary opacity-90 hover:opacity-60 rounded-lg text-center cursor-not-allowed',
        cancel:
          'border border-transparent shadow-sm rounded-md text-gray-400 bg-gray-600 opacity-60 hover:bg-gray-200 hover:opacity-70 dark:text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-400 cursor-not-allowed',
        link: `text-${color} opacity-30 hover:opacity-40 cursor-not-allowed`,
        outline: `border border-${color} shadow-sm rounded-md text-${color} opacity-60 hover:bg-${color} hover:text-white hover:opacity-70 cursor-not-allowed`,
      }[look as string] ??
      `border border-transparent shadow-sm rounded-md text-white bg-${color} opacity-60 hover:bg-${color} hover:opacity-70 cursor-not-allowed`;
    const className =
      {
        iasql:
          'text-white bg-gradient-to-bl from-primary to-secondary opacity-90 hover:opacity-100 rounded-lg text-center',
        cancel:
          'border border-transparent shadow-sm rounded-md text-gray-400 bg-gray-600 opacity-90 hover:bg-gray-200 hover:opacity-100 dark:text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-400',
        link: `text-${color} opacity-70 hover:opacity-100`,
        outline: `border border-${color} shadow-sm rounded-md text-${color} opacity-90 hover:bg-${color} hover:text-white hover:opacity-100 `,
      }[look as string] ??
      `border border-transparent shadow-sm rounded-md text-white bg-${color} opacity-90 hover:bg-${color} hover:opacity-100`;
    return disabled ? (
      <button
        ref={ref}
        id={id}
        disabled
        onClick={onClick}
        type={type}
        className={classNames(disabledClassName, commonClasses, customClassName)}
      >
        {children}
      </button>
    ) : (
      <button
        ref={ref}
        id={id}
        onClick={onClick}
        type={type}
        className={classNames(className, commonClasses, customClassName)}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
