const fs = require('fs');

let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

code = code.replace(
  /<div className="text-sm font-bold text-indigo-700">의사에게 전달할 증상을 입력해주세요\.<\/div>[\s\S]*?제출 및 원장님께 전송<\/button>\s*<\/>\s*\)\s*:\s*\(\s*<div className="text-center py-6">\s*<div className="font-bold text-slate-800">문진표가 제출되었습니다\.<\/div>\s*<div className="text-sm text-slate-500 mt-2">제출된 정보는 진료 시 원장님 화면에 요약되어 표기됩니다\.<\/div>\s*<button onClick=\{\(\)=>setIsIntakeSubmitted\(false\)\} className="mt-4 text-xs text-blue-600 underline">다시 작성하기<\/button>\s*<\/div>/,
  `<div className="text-sm font-bold text-indigo-700">{getLocalizedText(transLang, 'intakeTitle')}</div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{getLocalizedText(transLang, 'q1')}</label>
                          <textarea className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" rows={2} value={intakeForm.symptom} onChange={e=>setIntakeForm({...intakeForm, symptom:e.target.value})} placeholder={getLocalizedText(transLang, 'p1')}></textarea>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{getLocalizedText(transLang, 'q2')}</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" value={intakeForm.duration} onChange={e=>setIntakeForm({...intakeForm, duration:e.target.value})} placeholder={getLocalizedText(transLang, 'p2')} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{getLocalizedText(transLang, 'q3')}</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" value={intakeForm.history} onChange={e=>setIntakeForm({...intakeForm, history:e.target.value})} placeholder={getLocalizedText(transLang, 'p3')} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">{getLocalizedText(transLang, 'q4')}</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" value={intakeForm.occupation} onChange={e=>setIntakeForm({...intakeForm, occupation:e.target.value})} placeholder={getLocalizedText(transLang, 'p4')} />
                        </div>
                        <button onClick={async () => {
                          try {
                            const res = await fetch('/api/translate/intake', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ lang: transLang, symptom: intakeForm.symptom, duration: intakeForm.duration, history: intakeForm.history, occupation: intakeForm.occupation, chatHistory: translationChat })
                            });
                            if (res.ok) {
                              setIsIntakeSubmitted(true);
                            }
                          } catch (error) { console.error(error); }
                        }} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">{getLocalizedText(transLang, 'submit')}</button>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <div className="font-bold text-slate-800">{getLocalizedText(transLang, 'submitted')}</div>
                        <div className="text-sm text-slate-500 mt-2">{getLocalizedText(transLang, 'submittedDesc')}</div>
                        <button onClick={()=>setIsIntakeSubmitted(false)} className="mt-4 text-xs text-blue-600 underline">{getLocalizedText(transLang, 'retry')}</button>
                      </div>`
);

code = code.replace(
  /<h3 className="text-lg font-bold text-slate-800 mb-4">\{transLang\} 전자 동의서 \(Consent Form\)<\/h3>[\s\S]*?<strong>\[시술 및 비급여 진료 동의서\]<\/strong><br\/>\s*<br\/>\s*1\. 본인은 담당 의사로부터 진단, 시술 목적, 예상되는 경과 및 부작용, 대체 가능한 처료 방법 등에 대해 충분한 설명을 들었습니다\.<br\/>\s*2\. 본인은 의료진이 최선을 다하더라도 예상치 못한 합병증이 발생할 수 있음을 이해합니다\.<br\/>/g,
  `<h3 className="text-lg font-bold text-slate-800 mb-4">{transLang} {getLocalizedText(transLang, 'consentTitle')}</h3>
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded text-sm leading-relaxed text-slate-700 h-40 overflow-y-auto">
                           <strong>[{getLocalizedText(transLang, 'consentTitle')}]</strong><br/><br/>
                           <span className="whitespace-pre-wrap">{getLocalizedText(transLang, 'consentText')}</span><br/>`
);

code = code.replace(
  /다국어 환자 진료 요약 & 복약지도/g,
  `{getLocalizedText(transLang, 'summaryTitle')}`
);
code = code.replace(
  /요약문 생성<\/button>/g,
  `{getLocalizedText(transLang, 'generateSummary')}</button>`
);
code = code.replace(
  /서명 저장<\/button>/g,
  `{getLocalizedText(transLang, 'save')}</button>`
);
code = code.replace(
  /서명 완료<\/div>/g,
  `{getLocalizedText(transLang, 'signing')}</div>`
);
code = code.replace(
  /지우기<\/button>/g,
  `{getLocalizedText(transLang, 'clear')}</button>`
);
code = code.replace(
  /다시 서명하기<\/button>/g,
  `{getLocalizedText(transLang, 'retry')}</button>`
);

code = code.replace(
  /서명란 \(Signature\)/g,
  `{getLocalizedText(transLang, 'signHere')}`
);
code = code.replace(
  /서명을 입력해주세요\./g,
  `\${getLocalizedText(transLang, 'reqSign')}`
);


fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
