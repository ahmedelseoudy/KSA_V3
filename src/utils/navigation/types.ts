export interface NavItem {
  path: string;
  label: string;
  /** Icon key resolved to an inline SVG in Navigation.astro */
  icon: string;
  roles: string[];
  /** Section heading the item is grouped under in the sidebar */
  group: string;
}

export interface MenuState {
  isLocked: boolean;
}

export interface MenuHandlers {
  showMenu: () => void;
  hideMenu: () => void;
  toggleMenu: () => void;
  toggleLock: () => void;
}
