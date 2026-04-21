
'use client';
import { useState } from 'react';
import { Activity, Beaker } from 'lucide-react';

const EMERGENCY_PROTOCOLS: Record<string, any> = {
  '심정지 (ACLS)': {
    title: '성인 심정지 즉각 조치 프로토콜 (ACLS)',
    description: '환자 호흡과 맥박이 없을 때 즉각 시행해야 하는 생명 구조 필수 알고리즘.',
    steps: [
      { action: '1. CPR 및 산소', detail: '가슴을 강하고 빠르게 압박(분당 100-120회, 깊이 5cm). 100% 산소를 투여.' },
      { action: '2. 리듬 제세동', detail: 'VF/pVT인 경우 120~200J 제세동 1회 실시 직후 CPR 재개.' },
      { action: '3. 에피네프린 투여', detail: 'Epinephrine 1mg IV/IO 투여. 매 3~5분 간격 반복.' },
      { action: '4. 아미오다론 투여', detail: 'VF/pVT 지속 시 첫 번째 300mg, 두 번째 150mg IV/IO 투여.' }
    ]
  },
  '아나필락시스': {
    title: '아나필락시스 초응급 처치',
    description: '알레르기 반응이 기도 폐쇄 및 쇼크를 유발하는 극심한 응급상황.',
    steps: [
      { action: '1. 에피네프린 IM 주사 (최우선)', detail: '대퇴부 전외측에 에피네프린(1:1000) 0.3~0.5mg 근육주사. (5~15분 간격 반복)' },
      { action: '2. 산소 및 자세', detail: '산소(8-10 L/min) 투여. 하지를 올린 상태로 눕혀 정맥 환류량 확보.' },
      { action: '3. 수액 보충', detail: '저혈압 시 생리식염수(N/S) 1~2L 급속 투여.' },
      { action: '4. 보조 약물', detail: '항히스타민제(디펜히드라민 25-50mg IV) 및 부신피질호르몬 125mg IV.' }
    ]
  },
  '급성 저혈당': {
    title: '중증 급성 저혈당 뇌손상 방지',
    description: '혈당 수치 저하로 발작, 혼수 상태를 유발할 수 있음.',
    steps: [
      { action: '1. 의식 확인 및 경구 당 투여', detail: '의식이 뚜렷하다면 단순 당 15~20g 경구 투여.' },
      { action: '2. 정맥 포도당 투여', detail: '의식이 없으면 50% 포도당(50% DW) 50mL 즉시 정맥주사(IV bolus).' },
      { action: '3. 글루카곤 주사 (정맥로 불가시)', detail: '정맥로 확보가 지연되면 글루카곤 1mg IM 또는 SC 투여.' }
    ]
  },
  '뇌전증 발작': {
    title: '뇌전증 중첩증 (Status Epilepticus)',
    description: '5분 이상 발작이 계속되거나, 의식 회복 없이 반복될 때.',
    steps: [
      { action: '1. 기도 보호', detail: '환자를 위험환경에서 분리하고 몸을 옆으로 눕힘. 억지로 입벌리기 금지.' },
      { action: '2. 1차 항경련제 벤조디아제핀', detail: 'Lorazepam 4mg IV 또는 Diazepam 10mg IV 투여.' },
      { action: '3. 2차 항경련제 부하', detail: '발작지속 시 Phenytoin (20mg/kg) 또는 Valproate 정맥 투여.' },
      { action: '4. 기도삽관 고려', detail: '호흡 억제 징후 시 인공호흡기 준비 및 프로포폴 투여 병행.' }
    ]
  }
};

export default function Emergency() {
  const [activeProtocol, setActiveProtocol] = useState<string | null>(null);

  return (
    <div className="p-2 w-full mx-auto space-y-6">
       <div className="bg-red-600 rounded-xl p-8 text-white shadow-xl mb-8 flex flex-col justify-center border-l-8 border-red-800">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 flex items-center gap-3">
             <Activity className="w-8 h-8"/> 1초가 급한 순간, 즉각 대응 프로토콜
          </h2>
          <p className="text-red-100 text-lg">가장 치명적인 4대 응급 상황입니다. 복잡한 입력 없이 클릭 한 번으로 대응 순서를 바로 확인하세요.</p>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {Object.keys(EMERGENCY_PROTOCOLS).map((key) => (
             <button
               key={key}
               onClick={() => setActiveProtocol(key)}
               className={`p-6 rounded-2xl border-2 font-bold text-xl text-left transition transform shadow-sm ${
                 activeProtocol === key 
                 ? 'bg-red-50 border-red-500 text-red-700 shadow-md scale-100' 
                 : 'bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50 scale-95'
               }`}
             >
               <span className="flex justify-between items-center">
                  {key} 
                </span>
             </button>
          ))}
       </div>

       {activeProtocol && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-10 border-t-8 border-t-red-600">
             <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
                <div>
                   <h3 className="text-3xl font-extrabold text-slate-900 mb-2">{EMERGENCY_PROTOCOLS[activeProtocol].title}</h3>
                   <p className="text-lg text-slate-500 font-medium">{EMERGENCY_PROTOCOLS[activeProtocol].description}</p>
                </div>
                <button onClick={() => setActiveProtocol(null)} className="mt-4 sm:mt-0 font-bold bg-slate-100 text-slate-500 px-4 py-2 hover:bg-slate-200 rounded-full transition">닫기</button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                {EMERGENCY_PROTOCOLS[activeProtocol].steps.map((step: any, idx: number) => (
                   <div key={idx} className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm flex items-start gap-4">
                      <div className="bg-red-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                         {idx + 1}
                      </div>
                      <div>
                         <h4 className="text-xl font-bold text-slate-800 mb-2">{step.action.replace(/^d+.s*/, '')}</h4>
                         <p className="text-slate-600 text-base font-medium leading-relaxed">{step.detail}</p>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       )}
    </div>
  );
}
