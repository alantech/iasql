import { useMemo } from 'react';

import { useRouter } from 'next/router';

// A custom hook that builds on useLocation to parse
// the query string for you.
export function useQueryParams() {
  const { search } = useRouter().query;

  return useMemo(() => new URLSearchParams(search as string), [search]);
}
