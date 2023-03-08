import { ExclamationCircleIcon } from '@heroicons/react/outline';

import { Modal, Label } from './common';

export default function RageClickers({ show }: { show: (arg0: boolean) => void }) {
  return (
    <Modal
      title='Why so many clicks?'
      icon={<ExclamationCircleIcon className='h-6 w-6 text-warn' aria-hidden='true' />}
      onClose={() => show(false)}
    >
      <img src='https://media4.giphy.com/media/zCpYQh5YVhdI1rVYpE/giphy.gif' />
      <Label>Some operations can take their time since they depend on the cloud provider API.</Label>
      <Label>Please be patient or contact us if you think something is wrong.</Label>
    </Modal>
  );
}
