interface MenuState {
  isOpen: boolean;
  isLocked: boolean;
}

class MenuStateManager {
  private state: MenuState;
  private listeners: Set<(state: MenuState) => void>;

  constructor() {
    const savedState = localStorage.getItem('menuState');
    this.state = savedState ? JSON.parse(savedState) : { isOpen: true, isLocked: false };
    this.listeners = new Set();
    
    // Initialize state
    this.setState(this.state);
  }

  subscribe(listener: (state: MenuState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: MenuState) {
    this.state = newState;
    localStorage.setItem('menuState', JSON.stringify(this.state));
    this.listeners.forEach(listener => listener(this.state));
  }

  toggle() {
    this.setState({ ...this.state, isOpen: !this.state.isOpen });
  }

  toggleLock() {
    this.setState({ ...this.state, isLocked: !this.state.isLocked });
  }

  getState(): MenuState {
    return { ...this.state };
  }
}

export const menuState = new MenuStateManager();