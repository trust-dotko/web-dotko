/**
 * DEPRECATED — Use `useAuth()` from `../contexts/AuthContext` instead.
 * This file exists only for backward compatibility.
 */
import { useAuth } from '../contexts/AuthContext';

export function useFirebaseAuth() {
  const { user, login, logout, loading } = useAuth();
  return { user, login, logout, loading };
}
