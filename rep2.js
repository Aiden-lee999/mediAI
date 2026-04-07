const fs = require('fs');

let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const s1 = \                     <>
                       <div className="text-sm font-bold text-indigo-700">의사에게 전달할 증상을 입력해주세요.</div>
                       <div>
                         <label className="block text-xs font-semibold text-slate-600 mb-1">Q. 어디가 불편하신가요? (주호소)</label>
                         <textarea className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" rows={2} value={intakeForm.symptom} onChange={e=>setIntakeForm({...intakeForm, symptom:e.target.value})} placeholder="예: 머리가 아프고 열이 납니다..."></textarea>
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-slate-600 mb-1">Q. 증상이 কবে부터 시작되었나요?</label>
                         <input type="text" className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" value={intakeForm.duration} onChange={e=>setIntakeForm({...intakeForm, duration:e.target.value})} placeholder="예: 3일 전부터" />
                       </div>
                       <div>
                         <label className="block text-xs font-semibold text-slate-600 mb-1">Q. 복용 중인 약이나 기저질환이 있나요?</label>
                         <input type="text" className="w-full p-2 border border-slate-300 rounded bg-slate-50 focus:bg-white" value={intakeForm.history} onChange={e=>setIntakeForm({...intakeForm, history:e.target.value})} placeholder="예: 고혈압 약 복용중" />
                       </div>
                       <button onClick={async () => {
                         try {
                           const res = await fetch('/api/translate/intake', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ lang: transLang, symptom: intakeForm.symptom, duration: intakeForm.duration, history: intakeForm.history, chatHistory: translationChat })
                           });
                           if (res.ok) {
                             setIsIntakeSubmitted(true);
                           }
                         } catch (error) { console.error(error); }
                       }} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">제출 및 원장님께 전송</button>
                     </>\;

const t1 = \                     <>
                       <div className="text-sm font-bold text-indigo-700">{getLocalizedText(transLang, 'intakeTitle')}</div>
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
                     </>\;

code = code.replace(s1, t1);

const s2 = \                     ) : (
                       <div className="text-center py-6">
                         <div className="text-4xl mb-2"></div>
                         <div className="font-bold text-slate-800">문진표가 제출되었습니다.</div>
                         <div className="text-sm text-slate-500 mt-2">제출된 정보는 진료 시 원장님 화면에 요약되어 표기됩니다.</div>
                         <button onClick={()=>setIsIntakeSubmitted(false)} className="mt-4 text-xs text-blue-600 underline">다시 작성하기</button>
                       </div>
                     )\;
const t2 = \                     ) : (
                       <div className="text-center py-6">
                         <div className="text-4xl mb-2">✅</div>
                         <div className="font-bold text-slate-800">{getLocalizedText(transLang, 'submitted')}</div>
                         <div className="text-sm text-slate-500 mt-2">{getLocalizedText(transLang, 'submittedDesc')}</div>
                         <button onClick={()=>setIsIntakeSubmitted(false)} className="mt-4 text-xs text-blue-600 underline">{getLocalizedText(transLang, 'retry')}</button>
                       </div>
                     )\;

code = code.replace(s2, t2);

fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
