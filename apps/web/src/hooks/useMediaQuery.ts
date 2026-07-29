import { useEffect, useState } from 'react';

/**
 * Tracks a media query.
 *
 * Uses matchMedia rather than a `resize` listener so every consumer flips at
 * exactly the same breakpoint the stylesheet uses, and so the state cannot
 * drift when a viewport change arrives without a resize event.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Re-sync on mount: the query may already differ from the initial state
    // if the viewport changed between render and effect.
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
