import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_45%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between">
        <header className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
          <div>
            <div className="text-lg font-black tracking-tight text-slate-900">AIMDNET</div>
            <div className="text-xs text-slate-500">의사 전용 의료 AI 워크스테이션</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              로그인
            </Link>
            <Link href="/dashboard?view=translate" className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 sm:inline-flex">
              통역 바로가기
            </Link>
          </div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              진료실 다국어 번역 음성 지원
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
              환자 설명을 말하면,
              <br />
              선택한 언어로 번역하고 바로 들려줍니다.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              진료실에서 자주 쓰는 복약지도, 검사 안내, 시술 전 설명을 빠르게 번역하고 음성으로 재생할 수 있습니다. 모바일에서는 바로 통역 화면으로 진입할 수 있게 구성했습니다.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-800">
                보안 로그인
              </Link>
              <Link href="/dashboard?view=translate" className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-white px-6 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
                데스크톱에서 통역 열기
              </Link>
            </div>

            <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:hidden">
              <div className="text-sm font-bold text-emerald-900">모바일 빠른 실행</div>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                휴대폰에서는 아래 버튼을 누르면 로그인 절차를 거치지 않고 통역 화면으로 바로 들어갑니다.
              </p>
              <Link href="/dashboard?view=translate" className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700">
                휴대폰에서 바로 통역 시작
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-blue-100 backdrop-blur">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">진료실 다국어 번역</div>
                  <div className="text-xs text-slate-400">음성 입력 → 의료 번역 → 음성 재생</div>
                </div>
                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Mobile Ready
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="text-xs text-slate-400">원문 예시</div>
                  <div className="mt-2 text-sm leading-6 text-slate-100">
                    “이 약은 식후 30분 뒤에 드시고, 어지럽거나 속이 불편하면 바로 병원으로 연락해 주세요.”
                  </div>
                </div>
                <div className="rounded-2xl bg-blue-500/15 p-4">
                  <div className="text-xs text-blue-200">번역 음성 출력 예시</div>
                  <div className="mt-2 text-sm leading-6 text-white">
                    “Please take this medicine 30 minutes after meals, and contact the clinic immediately if you feel dizzy or have stomach discomfort.”
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
