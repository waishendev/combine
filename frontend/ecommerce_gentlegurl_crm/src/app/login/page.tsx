'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      console.log('Attempting login...');
      const response = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      console.log('Login successful, response:', response);

      // Small delay to ensure cookies are set
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Use router.refresh() to ensure cookies are updated before navigation
      router.refresh();
      console.log('Navigating to /dashboard...');
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof Error) {
        // Check for CORS or network errors
        if (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError')
        ) {
          setError(
            'CORS错误：无法连接到后端服务器。请检查后端CORS配置是否允许来自 http://localhost:3000 的请求，并确保允许 credentials。',
          );
        } else {
          setError(err.message || 'Login failed');
        }
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.24),_transparent_45%),_radial-gradient(circle_at_20%_20%,_rgba(14,165,233,0.2),_transparent_35%),_radial-gradient(circle_at_80%_0,_rgba(236,72,153,0.18),_transparent_30%)]" aria-hidden />

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl bg-slate-900/70 shadow-2xl backdrop-blur-lg ring-1 ring-white/10 lg:grid-cols-[1.2fr_1fr]">
        <section className="hidden border-r border-white/5 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-slate-900/0 px-8 py-10 text-left lg:block">
          <p className="text-sm uppercase tracking-[0.2em] text-indigo-100/80">Gentlegurl CRM</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-white">
            电商团队的<br />
            全渠道客户管控中枢
          </h1>
          <p className="mt-4 text-sm text-indigo-50/80">
            登录仪表盘，统一查看订单、客户互动、售后工单与业绩指标。轻盈的体验，帮你聚焦增长。
          </p>
          <div className="mt-8 space-y-4 text-sm text-indigo-50/80">
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">1</span>
              <div>
                <p className="font-semibold text-indigo-50">智能线索分配</p>
                <p className="text-indigo-100/70">自动为销售路由高意向线索，减少人工分配时间。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">2</span>
              <div>
                <p className="font-semibold text-indigo-50">实时数据脉搏</p>
                <p className="text-indigo-100/70">订单、复购、客服满意度一屏掌握，及时调整策略。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">3</span>
              <div>
                <p className="font-semibold text-indigo-50">安全合规</p>
                <p className="text-indigo-100/70">企业级权限与日志管控，守护每个客户数据的安全。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-md space-y-6">
            <div className="space-y-2 text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-200">Welcome back</p>
              <h2 className="text-3xl font-semibold text-white">登录 CRM</h2>
              <p className="text-sm text-slate-200/80">
                授权后即可进入电商 CRM 控制台，集中管理客户、订单与运营节奏。
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-100" htmlFor="email">
                  工作邮箱
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-100" htmlFor="password">
                  密码
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-white/10 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="请输入密码"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300/80">
                <span>确保使用企业账号登录</span>
                <span className="font-semibold text-indigo-200">忘记密码？请联系管理员</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="absolute inset-0 translate-y-full bg-white/10 transition duration-500 group-hover:translate-y-0" aria-hidden />
                <span className="relative">{loading ? '正在登录...' : '进入控制台'}</span>
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-300/70">
              登录即表示同意《数据安全与隐私条款》与《客户服务协议》
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
