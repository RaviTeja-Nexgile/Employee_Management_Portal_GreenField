// Auth context: the current user, the CSRF token in memory, sign-in,
// sign-out and the 401 reset.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api, onUnauthorized, setCsrfToken, type User } from './api'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User>
  signOut: () => Promise<void>
  refresh: () => Promise<User | null>
}

const AuthContext = createContext<AuthState | null>(null)

interface MeResponse {
  user: User
  csrf_token: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const clear = useCallback(() => {
    setCsrfToken(null)
    setUser(null)
  }, [])

  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const data = await api.get<MeResponse>('/auth/me')
      setCsrfToken(data.csrf_token)
      setUser(data.user)
      return data.user
    } catch {
      clear()
      return null
    }
  }, [clear])

  useEffect(() => {
    mounted.current = true
    onUnauthorized(() => {
      if (mounted.current) clear()
    })
    refresh().finally(() => {
      if (mounted.current) setLoading(false)
    })
    return () => {
      mounted.current = false
      onUnauthorized(null)
    }
  }, [clear, refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post<MeResponse>('/auth/login', { email, password })
    setCsrfToken(data.csrf_token)
    setUser(data.user)
    return data.user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } catch {
      // The session is cleared locally even when the request fails.
    }
    clear()
  }, [clear])

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, refresh }),
    [user, loading, signIn, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
