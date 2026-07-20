import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { register, login } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import { AlertTriangle, ArrowRight, LockKeyhole } from 'lucide-react'

export default function Auth() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isFirebaseConfigured()) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-brand"><div className="brand-mark"><span>ИП</span></div><div><strong>ИП Платежи</strong><small>Контроль доходов и налогов</small></div></div>
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Firebase не настроен. Данные будут храниться только локально.
              </p>
            </div>
            <Button onClick={() => navigate('/onboarding')} className="w-full">
              Продолжить локально <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <div className="onboarding-brand"><div className="brand-mark"><span>ИП</span></div><div><strong>ИП Платежи</strong><small>Control center</small></div></div>
        <p className="eyebrow">ФИНАНСЫ БЕЗ ШУМА</p>
        <h1>Все ваши ИП.<br />Один понятный контур.</h1>
        <p>Доходы, обязательства, сроки и фактические платежи — раздельно по каждому профилю.</p>
        <div className="auth-security"><LockKeyhole className="size-4" /><span>Доступ к данным защищён вашей учётной записью.</span></div>
      </div>
      <Card className="auth-card">
        <CardContent className="space-y-5">
          <div><p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p><h2>{isLogin ? 'Войти в приложение' : 'Создать аккаунт'}</h2><p>{isLogin ? 'Продолжите работу со своими профилями.' : 'Настройка первого ИП займёт пару минут.'}</p></div>
          <div className="segmented-control">
            <button type="button" className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>Вход</button>
            <button type="button" className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>Регистрация</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Пароль</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                minLength={6}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Создать аккаунт'}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">Авторизация нужна для синхронизации между устройствами.</p>
        </CardContent>
      </Card>
    </div>
  )
}
