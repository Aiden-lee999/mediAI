'use client';
import { useState } from 'react';

export default function TranslateMCA() {
  const [transInput, setTransInput] = useState('');
  const [transLang, setTransLang] = useState('en');
  const [transOutput, setTransOutput] = useState('');
  const [transNote, setTransNote] = useState('');

  const handleTranslate = async () => {
    if (!transInput.trim()) return;
    setTransOutput('번역 중입니다... 의학 용어를 적절한 모국어 표현으로 매핑하고 있습니다.');
    setTransNote('');
    
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputText: transInput,
          sourceLanguage: '한국어',
          targetLanguage: transLang === 'en' ? '영어' : transLang === 'vi' ? '베트남어' : transLang === 'ru' ? '러시아어' : transLang === 'zh' ? '중국어' : '몽골어'
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTransOutput(data.translation);
        if (data.medicalNote) {
            setTransNote(`Medical Note: ${data.medicalNote}`);
        }
      } else {
        setTransOutput(`번역 오류가 발생했습니다: ${data.error || res.statusText}`);
      }
    } catch (err: any) {
      setTransOutput(`네트워크 오류가 발생했습니다: ${err.message}`);
    }
  };

  return (
    <div className="w-full  space-y-6">
      <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg border border-indigo-700">
        <h2 className="text-xl font-extrabold mb-2 flex items-center gap-2"> 다국어 진료 어시스턴트 (MCA)</h2>
        <p className="text-indigo-100 text-sm">일반 번역기로는 불가능한 '의학 전문 용어(증상, 통증 양상, 복약지도)'를 외국인 환자의 모국어로 정확하고 쉽게 양방향 통역 및 생성합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* 좌측 입력 영역 */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"> 복약지도 및 동의서 작성</h3>
            <textarea 
               className="w-full text-slate-800 border border-slate-300 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[160px] resize-y mb-4" 
               placeholder="한국어로 약의 주의사항이나 수술 동의 내용을 입력하세요.&#13;&#10;예: '이 항생제는 알레르기 반응이 있을 수 있으니 복용 후 발진이 생기면 즉시 중단하세요.'"
               value={transInput}
               onChange={(e) => setTransInput(e.target.value)}
            />
            
            <div className="flex gap-3 mb-2">
               <button className="flex-1 border border-slate-200 bg-slate-50 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-100">
                  ️ 음성 인식 (한국어)
               </button>
               <button className="flex-1 border border-slate-200 bg-slate-50 text-slate-600 rounded-lg py-2 text-sm font-medium hover:bg-slate-100">
                   병원 양식 사진 찍기
               </button>
            </div>
         </div>

         {/* 우측 출력 영역 */}
         <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100 flex flex-col justify-between">
            <div>
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-indigo-900 flex items-center gap-2">환자 모국어 번역 결과</h3>
                  <select 
                     className="border border-indigo-200 rounded-lg px-3 py-1 text-sm bg-white text-indigo-800 font-bold outline-none"
                     value={transLang}
                     onChange={(e) => setTransLang(e.target.value)}
                  >
                     <option value="en">미국 영어 (EN)</option>
                     <option value="vi">베트남어 (VI)</option>
                     <option value="ru">러시아어 (RU)</option>
                     <option value="zh">중국어 (ZH)</option>
                     <option value="mn">몽골어 (MN)</option>
                  </select>
               </div>

               {transOutput ? (
                  <div className="space-y-4 animate-fadeIn">
                     <div className="bg-white p-5 rounded-xl border border-indigo-200 text-indigo-900 text-[15px] whitespace-pre-wrap leading-relaxed shadow-sm">
                        {transOutput}
                     </div>
                     {transNote && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-xs text-red-800 font-medium">
                           <span className="font-bold"> 임상 번역 Note:</span> {transNote}
                        </div>
                     )}
                  </div>
               ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-indigo-300 opacity-80">
                     <div className="text-4xl mb-2">A / 文</div>
                     <div className="text-sm font-bold">임상 번역 대기 중...</div>
                  </div>
               )}
            </div>

            <div className="flex gap-3 mt-6">
               <button 
                  onClick={handleTranslate}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md"
               >
                  의학 전문 번역 실행
               </button>
               <button className="px-6 border border-indigo-300 bg-white text-indigo-600 rounded-xl py-3 font-bold text-sm tracking-wide shadow-sm" onClick={()=>window.print()}>
                  인쇄용 팝업
               </button>
            </div>
         </div>
      </div>

      {/* 통증 표현 양방향 통역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-6 relative overflow-hidden">
         <div className="absolute right-0 top-0 w-64 h-full bg-slate-50 -z-10 rounded-l-[100px]"></div>
         <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">의료 특화 양방향 텍스트/표현 차트</h3>
         <p className="text-sm text-slate-500 mb-4">환자가 말하는 애매한 통증 표현(예: 쑤신다, 우리하다)을 한국어 임상 용어로 자동 매핑합니다.</p>
         
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-100 p-3 rounded-lg text-center cursor-pointer hover:bg-blue-50 border border-slate-200">
               <div className="text-2xl mb-1"></div>
               <div className="font-bold text-sm text-slate-800">찌릿찌릿하다</div>
               <div className="text-xs text-slate-500 mt-1">Sharp / Shooting</div>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg text-center cursor-pointer hover:bg-blue-50 border border-slate-200">
               <div className="text-2xl mb-1"></div>
               <div className="font-bold text-sm text-slate-800">쑤신다</div>
               <div className="text-xs text-slate-500 mt-1">Throbbing / Aching</div>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg text-center cursor-pointer hover:bg-blue-50 border border-slate-200">
               <div className="text-2xl mb-1"></div>
               <div className="font-bold text-sm text-slate-800">화끈거린다</div>
               <div className="text-xs text-slate-500 mt-1">Burning</div>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg text-center cursor-pointer hover:bg-blue-50 border border-slate-200">
               <div className="text-2xl mb-1">️</div>
               <div className="font-bold text-sm text-slate-800">뻐근하다 (우리하다)</div>
               <div className="text-xs text-slate-500 mt-1">Dull Aching</div>
            </div>
         </div>
      </div>
    </div>
  );
}