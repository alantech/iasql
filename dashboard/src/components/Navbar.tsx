import { Fragment, useState } from 'react';

import { useAuth0 } from '@auth0/auth0-react';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { MenuIcon, XIcon, SunIcon, MoonIcon } from '@heroicons/react/outline';
import { UserIcon } from '@heroicons/react/solid';

import { ActionType, useAppContext } from '../AppProvider';
import logo from '../assets/logo.png';
import * as Posthog from '../services/posthog';

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar({ userPic }: { userPic: string }) {
  const { token, dispatch } = useAppContext();
  const { logout } = useAuth0();
  const homeUrl = 'https://iasql.com';
  const navigation = [
    { name: 'Schema', href: 'https://iasql.com/schema', current: false },
    { name: 'Docs', href: 'https://iasql.com/docs', current: false },
    { name: 'Discord', href: 'https://discord.com/invite/machGGczea', current: false },
  ];
  if (!('theme' in localStorage)) {
    localStorage.setItem(
      'theme',
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    );
  }
  const [isDarkMode, setDarkMode] = useState(localStorage.theme === 'dark');
  return (
    <Disclosure as='nav' className='bg-gray-800'>
      {({ open }) => (
        <>
          <div className='max-w-full mx-auto px-2 sm:px-4 lg:px-6'>
            <div className='relative flex items-center justify-between h-16'>
              <div className='absolute inset-y-0 left-0 flex items-center sm:hidden'>
                {/* Mobile menu button*/}
                <Disclosure.Button className='inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white focus:outline-none opacity-90 hover:opacity-100'>
                  <span className='sr-only'>Open main menu</span>
                  {open ? (
                    <XIcon className='block h-6 w-6' aria-hidden='true' />
                  ) : (
                    <MenuIcon className='block h-6 w-6' aria-hidden='true' />
                  )}
                </Disclosure.Button>
              </div>
              <div className='flex-1 flex items-center justify-center sm:items-stretch sm:justify-start'>
                <a href={homeUrl} className='flex-shrink-0 flex items-center mr-6'>
                  <img className='block lg:hidden h-8 w-auto' src={logo} alt='Workflow' />
                  <img className='hidden lg:block h-8 w-auto' src={logo} alt='Workflow' />
                </a>
                <div className='hidden sm:block sm:ml-6'>
                  <div className='flex space-x-4'>
                    {navigation.map(item => (
                      <a
                        key={item.name}
                        href={item.href}
                        className={classNames(
                          item.current
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                          'px-3 py-2 rounded-md text-sm font-medium',
                        )}
                        aria-current={item.current ? 'page' : undefined}
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className='h-8 flex-auto flex flex-row-reverse pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0'>
                <button
                  id='darkmodelightmodetoggle'
                  className='h-8 w-8'
                  onClick={() => {
                    const newIsDarkMode = !isDarkMode;
                    localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');
                    if (newIsDarkMode) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                    setDarkMode(newIsDarkMode);
                  }}
                >
                  <div className='h-8 text-white'>{isDarkMode ? <MoonIcon /> : <SunIcon />}</div>
                </button>
              </div>
              {token && (
                <div className='absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:pr-0'>
                  {/* Profile dropdown */}
                  <Menu as='div' className='ml-3 relative'>
                    <div>
                      <Menu.Button className='bg-gray-800 flex text-sm rounded-full focus:outline-none opacity-90 hover:opacity-100'>
                        <span className='sr-only'>Open user menu</span>
                        {userPic ? (
                          <img className='h-8 w-8 rounded-full' src={userPic} alt='' />
                        ) : (
                          <UserIcon className='text-gray-300 hover:text-white h-6 w-6' aria-hidden='true' />
                        )}
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
                      <Menu.Items className='origin-top-right z-50 dark:bg-background absolute right-0 mt-2 w-48 rounded-md py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none'>
                        <Menu.Item>
                          {({ active }) => (
                            <div
                              onClick={() => {
                                dispatch({
                                  action: ActionType.TrackEvent,
                                  token,
                                  data: {
                                    trackEventName: 'LOGOUT',
                                  },
                                });
                                Posthog.reset();
                                logout({ returnTo: homeUrl });
                              }}
                              className={classNames(
                                active ? 'bg-gray-100 dark:bg-gray-900 cursor-pointer' : '',
                                'block px-4 py-2 text-sm text-gray-700 dark:text-gray-200',
                              )}
                            >
                              Sign out
                            </div>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>
              )}
            </div>
          </div>

          <Disclosure.Panel className='sm:hidden'>
            <div className='px-2 pt-2 pb-3 space-y-1'>
              {navigation.map(item => (
                <Disclosure.Button
                  key={item.name}
                  as='a'
                  href={item.href}
                  className={classNames(
                    item.current
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                    'block px-3 py-2 rounded-md text-base font-medium',
                  )}
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
