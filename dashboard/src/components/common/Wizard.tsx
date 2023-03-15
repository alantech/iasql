import { Children } from 'react';

import { Button, HBox, Modal, VBox, align } from '.';
import { ActionType, useAppContext } from '../providers/AppProvider';

export function Wizard({
  icon,
  title,
  closeable,
  start,
  stack,
  setStack,
  nextEnabled,
  onNext,
  backEnabled = true,
  onBack,
  onClose,
  children,
}: {
  icon?: any | any[];
  title: string;
  closeable?: boolean;
  start: string;
  stack: string[];
  setStack: (arg0: string[]) => void;
  nextEnabled?: boolean;
  onNext: () => string;
  backEnabled?: boolean;
  onBack?:
    | ((curr: string, stack: string[]) => string[] | void)
    | ((curr: string) => string[] | void)
    | (() => string[] | void);
  onClose?: () => void;
  children: any[] | any;
}) {
  const { dispatch } = useAppContext();
  if (stack.length === 0) stack.push(start);
  const backDisabled = backEnabled ? stack.length === 1 : true;
  const currentStepId = stack[stack.length - 1];
  const steps = Children.toArray(children);
  const currentStep = steps.find((s: any) => s.type === Step && s.props.id === currentStepId);
  if (!currentStep) {
    // Somehow broken, set the error
    dispatch({ action: ActionType.SetError, data: { error: 'The Wizard has become confused' } });
    return <div />;
  }

  return (
    <Modal
      icon={icon}
      title={title}
      closeable={closeable ?? false}
      onClose={
        onClose ??
        (() => {
          /* Nothing */
        })
      }
    >
      <VBox>
        {currentStep}
        <HBox alignment={align.end}>
          <Button
            disabled={backDisabled}
            onClick={() => {
              // It *must* be a clone or React doesn't detect the change to it, since it doesn't see
              // the array object changing. Such a terrible footgun.
              const stackClone = [...stack];
              const curr = stackClone.pop();
              // If `onBack` exists and if it returns a new stack, use it, otherwise continue as is
              const newstack = onBack?.(curr ?? '###impossible###', stackClone) ?? stackClone;
              setStack(newstack);
            }}
            customClassName='mr-2'
          >
            Back
          </Button>
          {!(currentStep as any)?.props?.onFinish && (
            <Button
              disabled={typeof nextEnabled === 'boolean' && !nextEnabled}
              onClick={() => {
                const stackClone = [...stack];
                stackClone.push(onNext());
                setStack(stackClone);
              }}
            >
              Next
            </Button>
          )}
          {!!(currentStep as any)?.props?.onFinish && (
            <Button
              disabled={typeof nextEnabled === 'boolean' && !nextEnabled}
              onClick={(currentStep as any)?.props?.onFinish}
            >
              Finish
            </Button>
          )}
        </HBox>
      </VBox>
    </Modal>
  );
}

export function Step({
  id,
  finished,
  onFinish,
  children,
}: {
  id: string;
  finished?: boolean;
  onFinish?: () => void;
  children: any[] | any;
}) {
  if (!id) throw new Error('Must provide an id per step');
  if (finished && onFinish) onFinish(); // Never called, this just gets TSLint off my back
  return <>{children}</>;
}
