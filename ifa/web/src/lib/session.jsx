import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, badges: [], unread: 0, prefs: null, config: null });
  const refresh = useCallback(async () => {
    try {
      const [me, config] = await Promise.all([api.get('/api/auth/me'), state.config ? state.config : api.get('/api/config')]);
      setState({ loading: false, ...me, config });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.config]);
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // pastille de notifications rafraîchie quand l'app revient au premier plan
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [refresh]);
  const logout = async () => { await api.post('/api/auth/logout'); await refresh(); };
  return <Ctx.Provider value={{ ...state, refresh, logout, setUnread: (n) => setState((s) => ({ ...s, unread: n })) }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);

export const isStaff = (u) => u && u.role !== 'fan';
export const canEdit = (u) => u && (u.role === 'editor' || u.role === 'admin');
export const canModerate = (u) => u && (u.role === 'moderator' || u.role === 'admin');
