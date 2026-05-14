import Link from 'next/link';
import TranslateMCA from '@/components/dashboard/TranslateMCA';

export default function TranslatePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black md:text-2xl">다국어 진료 어시스턴트</h1>
            <p className="hidden text-xs text-slate-500 md:block">모바일 음성·채팅 기반 의료 전문 양방향 통역</p>
          </div>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link href="/dashboard" className="rounded-full border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50">대시보드</Link>
            <Link href="/chat" className="rounded-full bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">챗봇</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:py-8">
        <TranslateMCA />
      </main>
    </div>
  );
}
