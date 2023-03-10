import { ExclamationCircleIcon } from '@heroicons/react/outline';

import { Modal, Label } from './common';

const pickRandomImage = () => {
  const images = [
    'https://media4.giphy.com/media/zCpYQh5YVhdI1rVYpE/giphy.gif', // Michael Scott the office
    'https://media.tenor.com/mZZoOtDcouoAAAAC/stop-it-get-some-help.gif', // Jordan
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWQ2ZjJhYWZlMWIwZjgxMTM5ZjlmMmY2Y2FhZGJkMDQwMzZiZjQ3NiZjdD1n/Hr2rEQlFrDpCFu9Qt0/giphy.gif', // angry bunny
    'https://user-images.githubusercontent.com/5357435/223768025-7cead6de-7783-43ab-afb4-e4d0d143d561.gif', // destroy pc 1
    'https://user-images.githubusercontent.com/5357435/223768108-dd754c44-8b07-492a-895b-a6d2f19ea700.gif', // destroy pc 2
  ];
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
};

export default function RageClickers({ show }: { show: (arg0: boolean) => void }) {
  return (
    <Modal
      title='Why so many clicks?'
      icon={<ExclamationCircleIcon className='h-6 w-6 text-warn' aria-hidden='true' />}
      onClose={() => show(false)}
    >
      <img src={pickRandomImage()} />
      <Label>Some operations can take their time since they depend on the cloud provider API.</Label>
      <Label>
        Please be patient or contact us via{' '}
        <a className='text-primary' href='mailto:hello@iasql.com'>
          email
        </a>{' '}
        or{' '}
        <a className='text-primary' href='https://discord.iasql.com' target='_blank' rel='noreferrer'>
          Discord
        </a>{' '}
        if something seems wrong.
      </Label>
    </Modal>
  );
}
