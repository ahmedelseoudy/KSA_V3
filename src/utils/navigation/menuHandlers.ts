import type { MenuState, MenuHandlers } from './types';

export function createMenuHandlers(nav: HTMLElement | null): MenuHandlers {
  const state: MenuState = {
    isLocked: false
  };

  function showMenu(): void {
    if (!nav) return;
    nav.classList.remove('-translate-x-full');
    nav.classList.add('translate-x-0');
    nav.setAttribute('aria-expanded', 'true');
  }

  function hideMenu(): void {
    if (!nav || state.isLocked) return;
    nav.classList.remove('translate-x-0');
    nav.classList.add('-translate-x-full');
    nav.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu(): void {
    if (!nav) return;
    const isExpanded = nav.classList.contains('translate-x-0');
    if (isExpanded) {
      hideMenu();
    } else {
      showMenu();
    }
  }

  function toggleLock(): void {
    state.isLocked = !state.isLocked;
    if (state.isLocked) {
      showMenu();
    }
  }

  return {
    showMenu,
    hideMenu,
    toggleMenu,
    toggleLock
  };
}