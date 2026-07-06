import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'
import { auth } from './config'

export async function register(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function login(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logout(): Promise<void> {
  await signOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser(): User | null {
  return auth.currentUser
}
