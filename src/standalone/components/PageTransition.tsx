import React, { useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { Global, css } from '@emotion/react';

// Plain CSS keyframe names so we can reference them both in <Global> and inline styles
const ANIM_FORWARD = 'pt-slide-forward'; // entering a detail page
const ANIM_BACK = 'pt-slide-back'; // returning to a list page
const ANIM_NEUTRAL = 'pt-fade-up'; // same-level navigation

const DURATION = '0.24s';
const EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/** Returns the navigation "depth" of a path (detail pages = 1, lists = 0). */
const getDepth = (pathname: string): number =>
  /\/(deployment|module|stack|policy|provider)\//.test(pathname) ? 1 : 0;

/**
 * Wraps page content with directional slide animations on route changes.
 * - Entering a detail page (module, stack, etc.): slides in from the right.
 * - Returning to a list page: slides in from the left.
 * - Same-level navigation: subtle fade + slide up.
 *
 * Uses DOM-level animation restart — children are never re-mounted so data
 * fetches are not re-triggered.
 */
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const prevDepthRef = useRef(getDepth(location.pathname));
  const initialized = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip on initial mount — the default sx animation handles first render.
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    const currDepth = getDepth(location.pathname);
    const prevDepth = prevDepthRef.current;
    prevDepthRef.current = currDepth;

    const animName =
      currDepth > prevDepth ? ANIM_FORWARD : currDepth < prevDepth ? ANIM_BACK : ANIM_NEUTRAL;

    // Restart animation without re-mounting children
    el.style.animation = 'none';
    void el.offsetHeight; // force synchronous reflow
    el.style.animation = `${animName} ${DURATION} ${EASING} both`;
  }, [location.pathname]);

  return (
    <>
      <Global
        styles={css`
          @keyframes ${ANIM_FORWARD} {
            from {
              opacity: 0;
              transform: translateX(32px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes ${ANIM_BACK} {
            from {
              opacity: 0;
              transform: translateX(-32px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes ${ANIM_NEUTRAL} {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      />
      <Box
        ref={ref}
        sx={{
          animation: `${ANIM_NEUTRAL} ${DURATION} ${EASING} both`,
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </Box>
    </>
  );
};
