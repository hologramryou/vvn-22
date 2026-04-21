import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginApi } from '../api/students'

export const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const data = await loginApi(username, password)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user_role', data.role)
      localStorage.setItem('user_name', data.full_name)
      localStorage.setItem('user_id', String(data.id ?? ''))
      localStorage.setItem('club_id', String(data.club_id ?? ''))
      navigate('/dashboard')
    } catch {
      setError('Sai tên đăng nhập hoặc mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--color-primary,#1d4ed8)] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">VV</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Vovinam Fighting</h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống quản lý thi đấu</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#1d4ed8)] text-sm"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-[var(--color-primary,#1d4ed8)] hover:bg-[var(--color-primary-dark,#1e3a5f)] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Demo: <strong>admin</strong> / <strong>Admin@123</strong>
        </p>
      </div>
    </div>
  )
}
