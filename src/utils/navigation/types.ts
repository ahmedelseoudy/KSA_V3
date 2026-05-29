export interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[];
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