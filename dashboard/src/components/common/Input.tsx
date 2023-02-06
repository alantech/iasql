import { useState } from 'react';

export default function Input({
  type,
  name,
  value,
  setValue,
  required,
  validator,
  validationErrorMessage,
  onChange,
  placeholder,
}: {
  type: string;
  value: string;
  setValue: (arg0: string) => void;
  name: string;
  required?: boolean;
  validator?: RegExp;
  validationErrorMessage?: string;
  onChange?: (arg0: any) => void;
  placeholder?: string;
}) {
  const [validationError, setValidationError] = useState('');
  const validateInput = (e: any) => {
    if (!e.target.value.match(validator)) {
      setValidationError(validationErrorMessage ?? 'Invalid input');
    } else {
      setValidationError('');
    }
  };
  const className =
    {
      search:
        'focus:ring-transparent focus:border-primary flex-1 block w-full sm:text-sm border-t-0 border-r-0 border-l-0 border-b-gray-300 dark:bg-gray-800 dark:text-gray-200',
    }[type as string] ??
    'focus:ring-primary focus:border-primary flex-1 block w-full rounded-none rounded-r-md sm:text-sm border-gray-300 dark:bg-gray-800 dark:text-gray-200';
  return (
    <>
      <input
        placeholder={placeholder ?? ''}
        type={type}
        name={name}
        id={name}
        required={required}
        className={className}
        value={value}
        onChange={e => {
          if (!!e.target.value && !!validator) validateInput(e);
          if (!!onChange) onChange(e);
          setValue(e.target.value);
        }}
      />
      <span className='text-xs text-red-600 mt-1'>{validationError}</span>
    </>
  );
}
