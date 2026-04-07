import { useLayoutEffect, useRef, useState } from 'react';

export function useTableScrollY<T extends HTMLElement = HTMLDivElement>(
  deps: ReadonlyArray<unknown> = [],
  reserve = 96,
  minHeight = 260,
) {
  const tableContainerRef = useRef<T | null>(null);
  const [tableScrollY, setTableScrollY] = useState(minHeight);

  useLayoutEffect(() => {
    const updateHeight = () => {
      if (!tableContainerRef.current || typeof window === 'undefined') return;
      const rect = tableContainerRef.current.getBoundingClientRect();
      const nextHeight = Math.max(minHeight, Math.floor(window.innerHeight - rect.top - reserve));
      setTableScrollY(nextHeight);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, [reserve, minHeight, ...deps]);

  return { tableContainerRef, tableScrollY } as const;
}
