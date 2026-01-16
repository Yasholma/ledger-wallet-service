const WALLET_ID_KEY = 'wallet_id';

export const sessionStorage = {
  getWalletId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(WALLET_ID_KEY);
  },

  setWalletId: (walletId: string): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(WALLET_ID_KEY, walletId);
  },

  clearWalletId: (): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(WALLET_ID_KEY);
  },
};
