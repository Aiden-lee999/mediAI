'use client';

import { useMemo, useRef, useState } from 'react';

type Speaker = 'doctor' | 'patient';

type LanguageOption = {
  code: string;
  label: string;
  apiLabel: string;
  speechCode: string;
  flag: string;
};

type ConversationTurn = {
  id: string;
  speaker: Speaker;
  sourceLanguage: string;
  targetLanguage: string;
  original: string;
  correctedInput: string;
  translation: string;
  backTranslation: string;
  note: string;
  medicalTerms: string[];
};

type SuggestedReply = {
  speaker: Speaker;
  text: string;
  meaningKo: string;
  intent: string;
};

type QuickPhrase = {
  ko: string;
  translations: Record<string, string>;
};

type SpeechRecognitionEventResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: SpeechRecognitionEventResult[] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', apiLabel: '영어', speechCode: 'en-US', flag: '🇺🇸' },
  { code: 'zh', label: '中文', apiLabel: '중국어', speechCode: 'zh-CN', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', apiLabel: '일본어', speechCode: 'ja-JP', flag: '🇯🇵' },
  { code: 'vi', label: 'Tiếng Việt', apiLabel: '베트남어', speechCode: 'vi-VN', flag: '🇻🇳' },
  { code: 'ru', label: 'Русский', apiLabel: '러시아어', speechCode: 'ru-RU', flag: '🇷🇺' },
  { code: 'mn', label: 'Монгол', apiLabel: '몽골어', speechCode: 'mn-MN', flag: '🇲🇳' },
  { code: 'th', label: 'ไทย', apiLabel: '태국어', speechCode: 'th-TH', flag: '🇹🇭' },
  { code: 'id', label: 'Bahasa Indonesia', apiLabel: '인도네시아어', speechCode: 'id-ID', flag: '🇮🇩' },
  { code: 'ar', label: 'العربية', apiLabel: '아랍어', speechCode: 'ar-SA', flag: '🇸🇦' },
];

const QUICK_PHRASES: QuickPhrase[] = [
  {
    ko: '어디가 가장 불편하세요?',
    translations: {
      en: 'Where do you feel the most discomfort?',
      zh: '您哪里最不舒服？',
      ja: 'どこが一番つらいですか？',
      vi: 'Bạn khó chịu nhất ở đâu?',
      ru: 'Где вы чувствуете самый сильный дискомфорт?',
      mn: 'Таны хаана хамгийн их зовиуртай байна вэ?',
      th: 'คุณรู้สึกไม่สบายตรงไหนมากที่สุด?',
      id: 'Bagian mana yang paling tidak nyaman?',
      ar: 'أين تشعر بأكبر قدر من الانزعاج؟',
    },
  },
  {
    ko: '통증은 언제부터 시작됐나요?',
    translations: {
      en: 'When did the pain start?',
      zh: '疼痛是什么时候开始的？',
      ja: '痛みはいつから始まりましたか？',
      vi: 'Cơn đau bắt đầu từ khi nào?',
      ru: 'Когда началась боль?',
      mn: 'Өвдөлт хэзээнээс эхэлсэн бэ?',
      th: 'อาการปวดเริ่มตั้งแต่เมื่อไหร่?',
      id: 'Sejak kapan nyerinya mulai?',
      ar: 'متى بدأ الألم؟',
    },
  },
  {
    ko: '이 약은 하루 세 번 식후에 드세요.',
    translations: {
      en: 'Please take this medicine three times a day after meals.',
      zh: '请每天三次饭后服用这种药。',
      ja: 'この薬は1日3回、食後に飲んでください。',
      vi: 'Vui lòng uống thuốc này ngày ba lần sau bữa ăn.',
      ru: 'Принимайте это лекарство три раза в день после еды.',
      mn: 'Энэ эмийг өдөрт гурван удаа хоолны дараа ууна уу.',
      th: 'กรุณากินยานี้วันละสามครั้งหลังอาหาร',
      id: 'Minum obat ini tiga kali sehari setelah makan.',
      ar: 'يرجى تناول هذا الدواء ثلاث مرات يوميًا بعد الطعام.',
    },
  },
  {
    ko: '발진, 호흡곤란, 얼굴 부종이 생기면 바로 중단하고 병원에 오세요.',
    translations: {
      en: 'If you get a rash, shortness of breath, or facial swelling, stop it and come to the hospital right away.',
      zh: '如果出现皮疹、呼吸困难或面部肿胀，请立即停药并来医院。',
      ja: '発疹、息苦しさ、顔の腫れが出たらすぐ中止して病院に来てください。',
      vi: 'Nếu bị phát ban, khó thở hoặc sưng mặt, hãy ngừng thuốc và đến bệnh viện ngay.',
      ru: 'Если появятся сыпь, одышка или отек лица, прекратите прием и сразу обратитесь в больницу.',
      mn: 'Тууралт, амьсгал давчдах, нүүр хавагнах шинж гарвал эмээ зогсоож шууд эмнэлэгт ирээрэй.',
      th: 'หากมีผื่น หายใจลำบาก หรือหน้าบวม ให้หยุดยาและมาโรงพยาบาลทันที',
      id: 'Jika muncul ruam, sesak napas, atau bengkak di wajah, hentikan obat dan segera datang ke rumah sakit.',
      ar: 'إذا ظهر طفح جلدي أو ضيق تنفس أو تورم في الوجه، أوقف الدواء وتعال إلى المستشفى فورًا.',
    },
  },
  {
    ko: '임신 가능성이나 수유 중인지 확인이 필요합니다.',
    translations: {
      en: 'We need to check whether you may be pregnant or breastfeeding.',
      zh: '我们需要确认您是否可能怀孕或正在哺乳。',
      ja: '妊娠の可能性や授乳中かどうかを確認する必要があります。',
      vi: 'Chúng tôi cần kiểm tra bạn có khả năng mang thai hoặc đang cho con bú không.',
      ru: 'Нужно уточнить, возможна ли беременность или кормите ли вы грудью.',
      mn: 'Та жирэмсэн байх магадлалтай эсэх эсвэл хөхүүл эсэхийг шалгах хэрэгтэй.',
      th: 'เราจำเป็นต้องตรวจสอบว่าคุณอาจตั้งครรภ์หรือกำลังให้นมบุตรหรือไม่',
      id: 'Kami perlu memastikan apakah Anda mungkin hamil atau sedang menyusui.',
      ar: 'نحتاج إلى التأكد مما إذا كان هناك احتمال حمل أو كنتِ ترضعين.',
    },
  },
  {
    ko: '복용 중인 약이나 알레르기가 있나요?',
    translations: {
      en: 'Are you taking any medicines, or do you have any allergies?',
      zh: '您正在服用药物吗？或者有过敏史吗？',
      ja: '服用中の薬やアレルギーはありますか？',
      vi: 'Bạn có đang dùng thuốc nào hoặc có dị ứng gì không?',
      ru: 'Вы принимаете какие-либо лекарства или у вас есть аллергия?',
      mn: 'Та ямар нэг эм ууж байгаа юу, эсвэл харшилтай юу?',
      th: 'คุณกำลังกินยาอะไรอยู่หรือมีอาการแพ้อะไรไหม?',
      id: 'Apakah Anda sedang minum obat atau punya alergi?',
      ar: 'هل تتناول أي أدوية أو لديك أي حساسية؟',
    },
  },
];

function getLocalizedPhrase(phrase: QuickPhrase, languageCode: string) {
  return phrase.translations[languageCode] || phrase.translations.en || phrase.ko;
}

function getSpeechLang(speaker: Speaker, patientLanguage: LanguageOption) {
  return speaker === 'doctor' ? 'ko-KR' : patientLanguage.speechCode;
}

function getLanguageLabels(speaker: Speaker, patientLanguage: LanguageOption) {
  return speaker === 'doctor'
    ? { sourceLanguage: '한국어', targetLanguage: patientLanguage.apiLabel, targetSpeechCode: patientLanguage.speechCode }
    : { sourceLanguage: patientLanguage.apiLabel, targetLanguage: '한국어', targetSpeechCode: 'ko-KR' };
}

export default function TranslateMCA() {
  const [input, setInput] = useState('');
  const [languageCode, setLanguageCode] = useState('en');
  const [speaker, setSpeaker] = useState<Speaker>('doctor');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedReply[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const patientLanguage = useMemo(
    () => LANGUAGES.find((lang) => lang.code === languageCode) || LANGUAGES[0],
    [languageCode]
  );

  const currentLabels = getLanguageLabels(speaker, patientLanguage);
  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const speak = (text: string, lang: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const startListening = () => {
    if (!speechSupported) {
      setStatus('이 브라우저는 음성 인식을 지원하지 않습니다. 모바일 Chrome 또는 Safari에서 다시 시도하세요.');
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = getSpeechLang(speaker, patientLanguage);
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = '';
      for (const result of Array.from(event.results)) {
        transcript += result[0]?.transcript || '';
      }
      setInput(transcript.trim());
    };
    recognition.onerror = (event) => {
      setStatus(`음성 인식 오류: ${event.error || '알 수 없는 오류'}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setStatus(`${speaker === 'doctor' ? '의료진 한국어' : patientLanguage.label} 음성을 듣고 있습니다.`);
    setListening(true);
    recognition.start();
  };

  const handleTranslate = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setStatus('의학 용어와 음성 인식 오류를 보정해 자연스럽게 통역 중입니다...');

    try {
      const context = turns.slice(-6).map((turn) => ({
        speaker: turn.speaker,
        original: turn.correctedInput || turn.original,
        translation: turn.translation,
      }));

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: trimmed,
          sourceLanguage: currentLabels.sourceLanguage,
          targetLanguage: currentLabels.targetLanguage,
          speaker,
          mode: 'clinical_conversation',
          context,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || res.statusText);

      const turn: ConversationTurn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        speaker,
        sourceLanguage: currentLabels.sourceLanguage,
        targetLanguage: currentLabels.targetLanguage,
        original: trimmed,
        correctedInput: data.correctedInput || trimmed,
        translation: data.translation || '',
        backTranslation: data.backTranslation || '',
        note: data.note || data.medicalNote || '',
        medicalTerms: Array.isArray(data.medicalTerms) ? data.medicalTerms : [],
      };

      setTurns((prev) => [...prev, turn]);
      setInput('');
      setStatus('통역 완료');
      speak(turn.translation, currentLabels.targetSpeechCode);
      void fetchSuggestedReplies(turn);
    } catch (err: any) {
      setStatus(`통역 오류: ${err?.message || '요청 실패'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedReplies = async (latestTurn: ConversationTurn) => {
    setSuggestionsLoading(true);
    setSuggestions([]);

    try {
      const context = [...turns, latestTurn].slice(-8).map((turn) => ({
        speaker: turn.speaker,
        original: turn.correctedInput || turn.original,
        translation: turn.translation,
      }));

      const res = await fetch('/api/translate/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latestSpeaker: latestTurn.speaker,
          latestOriginal: latestTurn.correctedInput || latestTurn.original,
          latestTranslation: latestTurn.translation,
          patientLanguage: patientLanguage.apiLabel,
          patientLanguageCode: patientLanguage.code,
          context,
        }),
      });

      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.suggestions)) return;
      setSuggestions(data.suggestions.slice(0, 5));
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const applySuggestedReply = (reply: SuggestedReply) => {
    stopListening();
    setSpeaker(reply.speaker);
    setInput(reply.text);
    setStatus(`${reply.speaker === 'doctor' ? '의료진' : '환자'} 예상 응답을 입력했습니다.`);
  };

  const toggleSpeaker = () => {
    stopListening();
    setSpeaker((prev) => (prev === 'doctor' ? 'patient' : 'doctor'));
    setInput('');
    setSuggestions([]);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-24 md:pb-6">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-700 via-blue-700 to-sky-600 p-5 text-white shadow-xl md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-blue-50">Mobile-first clinical interpreter</p>
            <h2 className="text-2xl font-black md:text-3xl">다국어 진료 어시스턴트 MCA</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-50">구글 번역기처럼 빠르고 자연스럽게, 진료실 문맥·복약지도·증상 표현·의학 용어를 보정해 양방향 음성/채팅 통역합니다.</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3 text-sm backdrop-blur">
            <div className="font-bold">환자 언어</div>
            <select
              className="mt-2 w-full rounded-xl border border-white/20 bg-white px-3 py-2 font-bold text-slate-900 outline-none"
              value={languageCode}
              onChange={(event) => {
                setLanguageCode(event.target.value);
                setSuggestions([]);
                setInput('');
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 text-sm font-black">
        <button
          onClick={() => setSpeaker('doctor')}
          className={`rounded-xl px-3 py-3 transition ${speaker === 'doctor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
        >
          의료진 → 환자
        </button>
        <button
          onClick={() => setSpeaker('patient')}
          className={`rounded-xl px-3 py-3 transition ${speaker === 'patient' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
        >
          환자 → 의료진
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-slate-800">{currentLabels.sourceLanguage} → {currentLabels.targetLanguage}</div>
            <div className="text-xs text-slate-500">{speaker === 'doctor' ? '의료진 설명을 환자 모국어로 쉽게 전달합니다.' : '환자 표현을 한국어 임상 표현으로 정리합니다.'}</div>
          </div>
          <button onClick={toggleSpeaker} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">방향 전환</button>
        </div>

        <textarea
          className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          placeholder={speaker === 'doctor' ? '예: 이 약은 하루 세 번 식후에 드시고, 숨이 차거나 발진이 생기면 바로 중단하세요.' : '환자 말을 입력하거나 마이크로 녹음하세요.'}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />

        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold text-slate-500">
            {patientLanguage.flag} {patientLanguage.label} 예시 문장 · {speaker === 'doctor' ? '누르면 한국어 원문이 입력됩니다.' : '누르면 환자 언어 원문이 입력됩니다.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PHRASES.map((phrase) => {
              const localized = getLocalizedPhrase(phrase, patientLanguage.code);
              const inputText = speaker === 'doctor' ? phrase.ko : localized;

              return (
                <button
                  key={phrase.ko}
                  onClick={() => setInput(inputText)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <span className="block text-[13px] font-black text-slate-900">{localized}</span>
                  <span className="mt-1 block text-[11px] font-medium text-slate-400">{phrase.ko}</span>
                </button>
              );
            })}
          </div>
        </div>

        {status && <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{status}</div>}

        {(suggestionsLoading || suggestions.length > 0) && (
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black text-indigo-900">맥락 기반 예상 응답</div>
                <div className="text-[11px] font-semibold text-indigo-500">방금 대화에 이어질 가능성이 높은 답변/후속질문입니다.</div>
              </div>
              {suggestionsLoading && <span className="text-[11px] font-bold text-indigo-500">생성 중...</span>}
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              {suggestions.map((reply, index) => (
                <button
                  key={`${reply.text}-${index}`}
                  onClick={() => applySuggestedReply(reply)}
                  className="rounded-2xl border border-indigo-100 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black text-indigo-500">
                    <span>{reply.speaker === 'doctor' ? '의료진 다음 질문' : `${patientLanguage.flag} 환자 예상 답변`}</span>
                    {reply.intent && <span className="rounded-full bg-indigo-50 px-2 py-0.5">{reply.intent}</span>}
                  </div>
                  <div className="text-sm font-black leading-5 text-slate-900">{reply.text}</div>
                  {reply.meaningKo && reply.meaningKo !== reply.text && (
                    <div className="mt-1 text-[11px] font-semibold text-slate-400">{reply.meaningKo}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={listening ? stopListening : startListening}
            className={`rounded-2xl py-4 text-sm font-black text-white shadow-lg transition ${listening ? 'bg-red-500 shadow-red-200' : 'bg-slate-900 shadow-slate-200'}`}
          >
            {listening ? '■ 녹음 중지' : '🎙️ 말로 입력'}
          </button>
          <button
            onClick={() => handleTranslate()}
            disabled={loading || !input.trim()}
            className="rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '통역 중...' : '통역하고 읽어주기'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {turns.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400">
            <div className="text-4xl">💬</div>
            <div className="mt-2 text-sm font-bold">대화를 시작하면 자연스러운 양방향 통역 기록이 여기에 쌓입니다.</div>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className={`rounded-3xl border p-4 shadow-sm ${turn.speaker === 'doctor' ? 'border-blue-100 bg-blue-50' : 'border-emerald-100 bg-emerald-50'}`}>
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-slate-500">
                <span>{turn.speaker === 'doctor' ? '의료진' : '환자'} · {turn.sourceLanguage} → {turn.targetLanguage}</span>
                <button onClick={() => speak(turn.translation, turn.speaker === 'doctor' ? patientLanguage.speechCode : 'ko-KR')} className="rounded-full bg-white px-3 py-1 text-slate-600 shadow-sm">다시 듣기</button>
              </div>
              <div className="rounded-2xl bg-white p-3 text-sm text-slate-600">
                <div className="font-bold text-slate-400">원문/보정</div>
                <div className="mt-1">{turn.correctedInput || turn.original}</div>
              </div>
              <div className="mt-3 rounded-2xl bg-slate-900 p-4 text-base font-semibold leading-7 text-white whitespace-pre-wrap">
                {turn.translation}
              </div>
              {turn.backTranslation && (
                <div className="mt-2 text-xs text-slate-500">역번역 확인: {turn.backTranslation}</div>
              )}
              {turn.medicalTerms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {turn.medicalTerms.map((term) => <span key={term} className="rounded-full bg-white px-2 py-1 text-xs font-bold text-indigo-700">{term}</span>)}
                </div>
              )}
              {turn.note && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">임상 메모: {turn.note}</div>}
            </div>
          ))
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2">
          <button onClick={listening ? stopListening : startListening} className={`rounded-2xl py-4 text-sm font-black text-white ${listening ? 'bg-red-500' : 'bg-slate-900'}`}>{listening ? '중지' : '🎙️ 말하기'}</button>
          <button onClick={() => handleTranslate()} disabled={loading || !input.trim()} className="rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white disabled:opacity-50">통역</button>
        </div>
      </div>
    </div>
  );
}
