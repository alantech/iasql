import { ExclamationCircleIcon } from '@heroicons/react/outline';

import { Modal, Label } from './common';

export default function SmallViewport({ showSmallViewport }: { showSmallViewport: (arg0: boolean) => void }) {
  return (
    <Modal
      title='Small viewport'
      icon={<ExclamationCircleIcon className='h-6 w-6 text-warn' aria-hidden='true' />}
      onClose={() => showSmallViewport(false)}
    >
      <Label>
        IaSQL is not optimized to work on this screen size. For a better experience use a larger screen.
      </Label>
    </Modal>
  );
}
