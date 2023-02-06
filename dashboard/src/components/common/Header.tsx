export default function Header({ headerTitle, children }: { headerTitle: string; children: any | any[] }) {
  return (
    <header className='bg-white dark:bg-gray-900 shadow'>
      <div className='flex justify-between items-center max-w-7xl mx-auto py-6 sm:px-4 lg:px-6'>
        <h1 className='text-3xl font-bold font-montserrat text-gray-900 dark:text-gray-200'>{headerTitle}</h1>
        <div className='flex'>{children}</div>
      </div>
    </header>
  );
}
