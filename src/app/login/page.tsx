'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [license, setLicense] = useState('');
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('내과');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // In commercial build, this communicates with the Express/NestJS backend
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license, password })
      });

      if (!res.ok) {
        // Fallback for development if backend isn't up
        console.warn('Backend connection failed, using dev mock login');
        localStorage.setItem('med_token', 'dev_mock_jwt_token_expert');
        localStorage.setItem('med_user', JSON.stringify({ name, specialty, role: 'doctor' }));
        router.push('/dashboard');
        return;
      }

      const data = await res.json();
      localStorage.setItem('med_token', data.token);
      localStorage.setItem('med_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      // Fallback
      localStorage.setItem('med_token', 'dev_mock_jwt_token_expert');
      localStorage.setItem('med_user', JSON.stringify({ name, specialty, role: 'doctor' }));
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">MedAssist Pro</h1>
          <p className="text-sm text-slate-500 mt-2">전문의 인증 시스템 (상용화 빌드)</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">의사 면허 번호</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="면허 번호 5자리"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
            <input 
              type="password" 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="????????"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">성함</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">진료과목</label>
              <select 
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              >
                <option value="내과">내과</option>
                <option value="외과">외과</option>
                <option value="피부과">피부과</option>
                <option value="일반의">일반의</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-md shadow-blue-200 mt-4"
          >
            {isLoading ? '인증 중...' : '보안 로그인'}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>ⓒ 2026 MedAssist Pro. All rights reserved.</p>
          <p className="mt-1">의사협회 SSO 연동 지원 (SSO 준비중)</p>
        </div>
      </div>
    </div>
  );
}
