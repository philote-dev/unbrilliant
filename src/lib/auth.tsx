import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth"

import { auth } from "@/lib/firebase"

export interface WillowUser {
  uid: string
  displayName: string
  email: string | null
}

type AuthContextValue = {
  user: WillowUser | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  updateDisplayName: (displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toWillowUser(u: User | null): WillowUser | null {
  if (!u) return null
  return { uid: u.uid, displayName: u.displayName ?? "", email: u.email }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WillowUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(toWillowUser(u))
      setLoading(false)
    })
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    async signInWithGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    async signUpWithEmail(email, password, displayName) {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })
      // onAuthStateChanged won't refire for a profile update — reflect it now.
      setUser({ uid: cred.user.uid, displayName, email: cred.user.email })
    },
    async signInWithEmail(email, password) {
      await signInWithEmailAndPassword(auth, email, password)
    },
    async updateDisplayName(displayName) {
      const current = auth.currentUser
      if (!current) return
      const trimmed = displayName.trim()
      await updateProfile(current, { displayName: trimmed })
      // onAuthStateChanged won't refire for a profile-only update, so reflect it now.
      setUser((prev) => (prev ? { ...prev, displayName: trimmed } : prev))
    },
    async signOut() {
      await fbSignOut(auth)
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
