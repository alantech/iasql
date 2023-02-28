import { align, VBox } from './common';

export default function EmptyState({ children }: { children: JSX.Element | JSX.Element[] }) {
  return (
    <VBox
      alignment={align.around}
      customClasses={`border-dashed border-2 dark:border-opacity-50 rounded-lg text-gray-400
        dark:text-gray-600 text-sm leading-6 font-medium place-content-center items-center py-8`}
    >
      {children}
    </VBox>
  );
}
