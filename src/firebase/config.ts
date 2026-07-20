import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyCvj1PxAiMTU562uoX3cx24NyVtptaEqdY',
  authDomain: 'ip-platezhi.firebaseapp.com',
  databaseURL: 'https://ip-platezhi-default-rtdb.firebaseio.com',
  projectId: 'ip-platezhi',
  storageBucket: 'ip-platezhi.firebasestorage.app',
  messagingSenderId: '190014606582',
  appId: '1:190014606582:web:ccb03fbf04d8ab3d9570d7',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)

export function isFirebaseConfigured(): boolean {
  // Allows a fully local build for development, demos and emergency offline
  // access without weakening authentication in the deployed application.
  const localMode = import.meta.env.VITE_LOCAL_MODE === 'true'
  return !localMode && firebaseConfig.apiKey !== 'YOUR_API_KEY'
}
