import { useEffect } from 'react';

/**
 * Global scroll-lock state tracker for handling nested or overlapping modals.
 */
let lockCount = 0;
let savedScrollY = 0;
let originalStyles = {
  bodyOverflow: '',
  htmlOverflow: '',
  position: '',
  top: '',
  width: '',
  paddingRight: '',
};

/**
 * Locks background scrolling across desktop and mobile devices.
 * Freezes body position at exact scroll offset to prevent mobile rubber-banding/touch scrolling.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    originalStyles = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
    };

    // Prevent desktop content shifting when scrollbar is hidden
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Freeze document root and body
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
  }

  lockCount++;
}

/**
 * Restores original document styles and scroll position when all modals are closed.
 */
export function unlockBodyScroll() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    // Disable smooth scrolling temporarily to prevent jump animation on restore
    document.documentElement.style.scrollBehavior = 'auto';

    document.documentElement.style.overflow = originalStyles.htmlOverflow || '';
    document.body.style.overflow = originalStyles.bodyOverflow || '';
    document.body.style.position = originalStyles.position || '';
    document.body.style.top = originalStyles.top || '';
    document.body.style.width = originalStyles.width || '';
    document.body.style.paddingRight = originalStyles.paddingRight || '';

    window.scrollTo(0, savedScrollY);

    // Restore original scroll behavior
    document.documentElement.style.scrollBehavior = originalScrollBehavior;
  }
}

/**
 * Custom React Hook to lock body and background scrolling while an overlay/modal is open.
 *
 * @param {boolean} isLocked Whether scrolling should be locked
 */
export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

