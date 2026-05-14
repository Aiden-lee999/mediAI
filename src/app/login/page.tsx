'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

type ModalView = 'terms' | 'form' | 'forgot' | null;

const specialties = ['내과', '외과', '소아청소년과', '산부인과', '정형외과', '피부과', '정신건강의학과', '영상의학과', '응급의학과', '가정의학과', '일반의'];
const hospitalTypes = ['의원', '병원', '종합병원', '상급종합병원', '요양병원', '검진센터', '기타'];
const signupWorkTypeOptions = ['풀타임', '파트타임', '야간', '주말', '대진', '정기알바'];
const signupWorkMethodOptions = ['상근', '비상근', '외래', '입원전담', '검진', '온콜', '재택/원격'];
const inputClass = 'h-9 w-full border border-[#d8dce3] bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#2f80ed] focus:ring-1 focus:ring-[#2f80ed]';
const buttonBlue = 'h-10 bg-[#172c91] px-10 text-sm font-bold text-white transition hover:bg-[#0f216f] disabled:bg-slate-300 disabled:cursor-not-allowed';
const buttonGray = 'h-10 bg-[#b7b7b7] px-10 text-sm font-bold text-white transition hover:bg-[#9f9f9f]';

const termsText = `제1조 목적
본 약관은 AIMDNET 의료진 전용 AI 진료지원 플랫폼, 웹사이트, 애플리케이션, API, 의약품 검색, DUR 안전성 검토, 문서 생성·편집, 요약·분석 및 이에 부수하는 서비스의 이용 조건, 절차, 회사와 회원의 권리·의무, 책임사항 및 기타 필요한 사항을 정합니다.

제2조 정의
1. “서비스”란 회사가 제공하는 AI 기반 정보 검색, 의학·의약품 정보 확인, 문서 작성 보조, 진료지원, 요약, 분류, 분석, 추천, 템플릿 생성 및 업무 자동화 기능을 말합니다.
2. “회원”이란 본 약관에 동의하고 회사가 정한 인증 절차를 거쳐 서비스를 이용하는 의료전문가 또는 회사가 승인한 사용자를 말합니다.
3. “환자정보”란 환자의 성명, 등록번호, 생년월일, 성별, 연락처, 주소, 진단명, 증상, 병력, 검사결과, 영상정보, 처방정보, 진료기록, 상담내용 등 환자를 식별할 수 있거나 건강상태와 관련된 정보를 말합니다.
4. “입력자료”란 회원이 서비스 이용 과정에서 입력, 업로드, 전송, 저장 또는 편집하는 텍스트, 파일, 이미지, 음성, 진료 관련 자료, 질문, 메모, 문서 등을 말합니다.
5. “산출물”이란 서비스가 입력자료, 회사의 데이터베이스, 외부 정보원, AI 모델 또는 템플릿을 바탕으로 생성·요약·분석·추천·편집한 답변, 문서, 표, 초안, 설명, 알림 및 결과물을 말합니다.

제3조 회원 자격 및 이용 승인
1. 서비스는 의료전문가, 의료기관 임직원 또는 회사가 별도로 승인한 사용자만 이용할 수 있습니다.
2. 회사는 회원가입, 계정 발급, 권한 부여 또는 기능 접근을 위해 면허번호, 소속 의료기관, 진료과목, 이메일, 휴대전화번호 등 회사가 정한 정보를 확인할 수 있습니다.
3. 회원은 가입 및 이용 과정에서 정확하고 최신의 정보를 제공해야 하며, 허위 정보, 타인의 정보, 도용된 정보, 만료되거나 정지된 자격 정보를 사용해서는 안 됩니다.
4. 회사는 의료전문가 자격 또는 소속 정보를 확인할 수 없거나 보안, 환자안전, 법령 준수 또는 서비스 운영상 위험이 있다고 판단되는 경우 가입 또는 이용 승인을 거절·제한·해지할 수 있습니다.

제4조 계정 및 인증정보 관리
1. 회원은 계정, 비밀번호, 인증수단, 접속토큰, API 키 등 인증정보를 선량한 관리자의 주의로 관리해야 합니다.
2. 회원은 계정 또는 인증정보를 제3자에게 양도, 대여, 공유, 담보 제공하거나 공동으로 사용할 수 없습니다.
3. 회원의 계정을 통해 이루어진 행위는 회원 본인의 행위로 간주됩니다. 다만 회사의 고의 또는 중대한 과실로 인한 경우는 제외합니다.
4. 회원은 계정 도용, 비밀번호 유출, 비정상 접근 또는 보안사고가 의심되는 경우 즉시 회사에 통지하고 회사의 보안조치에 협조해야 합니다.

제5조 서비스의 성격 및 의료적 책임
1. 서비스는 의료진의 업무 효율화와 의사결정 보조를 위한 참고 도구입니다.
2. 서비스가 제공하는 답변, 요약, 분석, 추천, 문서 초안, 의약품 정보, 참고자료, 위험 알림 등은 의료진의 전문적 판단을 대체하지 않습니다.
3. 회원은 서비스 산출물을 반드시 독립적으로 검토해야 하며, 진단, 처방, 투약, 검사, 시술, 수술, 환자 설명, 의무기록 작성 등 최종 의료행위에 대한 책임은 해당 의료진 및 소속 의료기관에 있습니다.
4. 서비스는 응급상황, 생명에 즉각적 위험이 있는 상황, 중환자 처치, 고위험 약물 투여, 법적 감정, 최종 판독, 최종 진단 또는 최종 처방의 단독 근거로 사용되어서는 안 됩니다.
5. 회사는 별도로 명시한 경우를 제외하고 특정 질환의 진단·치료 결과, 환자 예후, 의학적 정확성, 보험 심사 결과, 법적 적합성 또는 임상적 유용성을 보증하지 않습니다.

제6조 의료기기 및 인허가 관련 고지
1. 별도의 허가·인증·신고 범위가 명시되지 않은 기능은 의료진의 업무 보조 및 참고 목적의 정보처리 도구로 제공되며, 독립적인 진단·치료 결정 기능으로 제공되는 것이 아닙니다.
2. 특정 기능이 관련 법령상 의료기기, 디지털의료제품, 임상의사결정지원시스템 또는 이에 준하는 규제 대상에 해당하는 경우, 회사는 해당 기능의 허가·인증·신고 또는 고지 범위 내에서 서비스를 제공합니다.
3. 회원은 서비스별 사용설명서, 제한사항, 경고문, 업데이트 공지 및 기관 내부 사용승인 기준을 준수해야 합니다.

제7조 환자정보 및 민감정보 입력
1. 회원은 서비스 이용 시 환자의 성명, 주민등록번호, 연락처, 주소, 얼굴사진, 병원등록번호 등 직접 식별정보를 원칙적으로 입력하지 않아야 합니다.
2. 환자정보 입력이 불가피한 경우, 회원은 관련 법령, 환자 동의, 의료기관 내부 규정, 개인정보 처리위탁 관계 또는 기타 적법한 처리 근거를 갖춘 경우에 한해 필요한 최소한의 정보를 입력해야 합니다.
3. 회원은 환자정보 입력 시 가능한 범위에서 가명처리, 비식별화, 최소입력, 마스킹, 요약입력 등 보호조치를 취해야 합니다.
4. 회사는 식별 가능한 환자정보를 회원 또는 의료기관과의 별도 계약, 적법한 동의 또는 법령상 근거 없이 광고, 마케팅, 외부 판매 또는 외부 AI 모델 학습 목적으로 사용하지 않습니다.

제8조 지식재산권 및 데이터 권리
1. 서비스, 소프트웨어, 화면 구성, UI/UX, 데이터베이스, 검색 구조, 알고리즘, 모델 연동 구조, 프롬프트, 템플릿, 문서 양식, 편집 방식, 운영 노하우, 상표, 로고 및 이에 관한 지식재산권은 회사 또는 정당한 권리자에게 귀속됩니다.
2. 회원이 서비스에 입력한 입력자료 중 회원, 의료기관, 환자 또는 제3자에게 기존 권리가 있는 자료의 권리는 해당 권리자에게 유보됩니다.
3. 회사는 서비스 제공, 보안, 장애 대응, 고객지원, 이용현황 분석, 품질 개선, 법령상 의무 이행 및 분쟁 대응을 위해 필요한 범위에서 입력자료와 산출물을 저장, 처리, 분석, 변환, 삭제 또는 가공할 수 있습니다.
4. 회원은 회사의 사전 서면 동의 없이 서비스 산출물을 판매, 재배포, 데이터셋화, 외부 모델 학습, 경쟁 서비스 개발, 대량 복제 또는 상업적 재가공 목적으로 사용할 수 없습니다.

제9조 금지행위
회원은 타인의 계정·인증정보·면허번호 사용, 권한 없는 환자정보 입력, 산출물의 무검증 의료행위 사용, 서비스·화면·데이터베이스·알고리즘·프롬프트·API 응답·검색 결과의 무단 복제·저장·크롤링·스크래핑·다운로드·판매·재가공·재배포, 경쟁 서비스 개발·외부 AI 모델 학습·데이터셋 구축·역설계, 보안체계 우회, 자동화 봇·비정상 트래픽·취약점 탐색 등 서비스 안정성을 해치는 행위를 해서는 안 됩니다.

제10조 서비스 변경, 이용 제한 및 계약 해지
회사는 운영상, 기술상, 보안상 필요에 따라 서비스의 전부 또는 일부를 변경, 개선, 제한, 중단할 수 있습니다. 회원이 본 약관, 운영정책 또는 관련 법령을 위반하거나 보안·환자안전·서비스 안정성에 위험을 초래한다고 판단되는 경우 회사는 경고, 기능 제한, 계정 정지, 자료 삭제·차단, API 키 폐기, 회원자격 박탈, 관계기관 신고 또는 법적 조치를 할 수 있습니다.

제11조 개인정보 및 보안
회사는 개인정보 보호법 등 관련 법령에 따라 개인정보 및 환자정보 보호를 위한 기술적·관리적·물리적 보호조치를 시행합니다. 개인정보 처리에 관한 구체적인 사항은 회사의 개인정보 처리방침 및 개인정보 처리 안내에 따릅니다.

제12조 준거법 및 분쟁 해결
본 약관은 대한민국 법령에 따라 해석되고 적용됩니다. 회사와 회원 간 분쟁이 발생한 경우 양 당사자는 성실히 협의하여 해결하며, 협의로 해결되지 않는 분쟁은 민사소송법상 관할법원 또는 별도 계약에서 정한 관할법원을 제1심 관할법원으로 합니다.`;

const privacyText = `1. 개인정보 처리자
AIMDNET을 운영하는 회사는 의료진 전용 AI 진료지원 플랫폼 제공을 위해 개인정보를 처리합니다. 실제 정식 오픈 전 회사 법인명, 대표자, 주소, 개인정보 보호책임자 및 문의처는 서비스 화면 또는 개인정보 처리방침에 확정 고지합니다.

2. 개인정보 처리 원칙
1. 회사는 서비스 제공에 필요한 최소한의 개인정보만 처리합니다.
2. 회사는 회원의 개인정보를 명시한 목적 범위 내에서만 이용하며, 목적이 변경되는 경우 관계 법령에 따라 별도 안내 또는 동의를 받습니다.
3. 회사는 환자정보 및 민감정보의 입력을 최소화하도록 안내하며, 식별 가능한 환자정보는 별도 법적 근거, 회원 또는 의료기관과의 계약, 또는 적법한 동의 없이 광고·마케팅·외부 판매·외부 AI 모델 학습 목적으로 사용하지 않습니다.
4. 회사는 개인정보의 안전한 처리를 위해 접근권한 관리, 암호화, 접속기록 보관, 보안관제, 취약점 점검 등 보호조치를 시행합니다.

3. 처리하는 개인정보 항목 및 목적
1. 회원가입 및 계정관리: 성명, 아이디, 이메일, 휴대전화번호, 비밀번호 해시, 소속기관, 진료과목, 직책, 계정상태, 가입일, 약관 동의·확인 기록을 회원 식별, 계정 생성, 로그인, 회원관리, 공지, 고객지원을 위해 처리합니다.
2. 의료전문가 자격 확인: 면허번호, 전문의 여부, 진료과목, 소속 의료기관, 요양기관번호 또는 회사가 요구하는 자격 확인 자료를 의료전문가 전용 서비스 제공, 자격 검증, 부정이용 방지, 권한 관리를 위해 처리합니다.
3. 서비스 이용 및 보안: 접속 IP, 접속 일시, 기기정보, 브라우저 정보, OS 정보, 쿠키, 접속 로그, 이용기록, 검색·조회 기록, 오류 로그, 보안 로그, API 호출 기록을 서비스 제공, 보안관제, 장애 대응, 부정이용 방지, 이용량 산정, 품질 개선을 위해 처리합니다.
4. AI 질의 및 산출물: 회원이 입력한 질의, 프롬프트, 파일, 문서, 메모, 검색어, 생성·편집된 문서, AI 답변, 요약·분석 결과를 AI 응답 생성, 문서 작성 보조, 질의 이력 제공, 오류 분석, 서비스 품질 관리, 고객지원을 위해 처리합니다.
5. 선택정보: 생년월일, 주소, 병원명, 관심 분야, 프로필 정보, 마케팅 수신 여부는 맞춤형 서비스, 교육자료 제공, 이벤트, 서비스 안내를 위해 처리할 수 있습니다.

4. 보유 및 이용 기간
회사는 회원 탈퇴 또는 목적 달성 시까지 개인정보를 보유·이용합니다. 다만 관계 법령상 보존 의무, 분쟁 대응, 보안 감사, 부정이용 방지, 요금 정산, 법령상 의무 이행을 위해 필요한 정보는 해당 목적 달성 시까지 분리 보관할 수 있습니다. 전자상거래가 적용되는 유료 서비스의 경우 계약·청약철회 기록과 대금결제·재화공급 기록은 5년, 소비자 불만·분쟁처리 기록은 3년 보존될 수 있습니다.

5. 제3자 제공
회사는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다. 다만 회원 또는 정보주체가 사전에 동의한 경우, 법령에 특별한 규정이 있는 경우, 수사기관·법원·감독기관 등이 적법한 절차에 따라 요청한 경우, 생명·신체·재산상 급박한 이익 보호를 위해 필요한 경우에는 제공할 수 있습니다.

6. 개인정보 처리위탁 및 외부 연동서비스
회사는 원활한 서비스 제공을 위해 클라우드, 인증, 알림, 고객지원, 보안관제, AI 모델/API 제공사, 의약품·문헌 데이터베이스 등 외부 연동서비스를 이용하거나 개인정보 처리업무의 일부를 위탁할 수 있습니다. 위탁계약 체결 시 목적 외 처리 금지, 재위탁 제한, 안전성 확보조치, 관리·감독, 손해배상 등 필요한 사항을 정합니다.

7. 국외 이전
해외 클라우드, 해외 AI 모델/API, 해외 고객지원 도구 등을 이용하여 개인정보를 국외로 이전하는 경우, 회사는 관계 법령에 따라 이전받는 자, 이전 국가, 이전 항목, 이전 목적, 이전 일시 및 방법, 보유·이용 기간, 보호조치, 동의 거부권 등을 안내하고 필요한 경우 별도 동의를 받습니다. 국외 이전이 없는 경우에는 개인정보 처리방침에 그 사실을 고지합니다.

8. 자동화된 처리 및 AI 결과 안내
서비스는 AI 기술을 활용하여 회원의 질의에 대한 답변, 문서 초안, 요약, 분석, 추천 등을 생성할 수 있습니다. AI 결과는 의료진의 검토와 판단을 전제로 제공되며, 환자의 권리·의무 또는 진료결과를 완전히 자동으로 확정하는 결정으로 사용되어서는 안 됩니다.

9. 정보주체의 권리
회원은 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회, 관계 법령상 적용되는 경우 개인정보 전송 요구 및 자동화된 결정에 대한 설명 요구 또는 거부 요구를 할 수 있습니다. 회사는 본인 확인 후 관계 법령에 따라 지체 없이 조치합니다.

10. 동의 거부권 및 불이익
회원은 개인정보 처리에 관한 동의 또는 선택정보 제공을 거부할 수 있습니다. 서비스 제공, 의료전문가 자격 확인, 계정 관리, 보안에 필요한 정보의 처리가 불가능한 경우 회원가입 또는 서비스 이용이 제한될 수 있습니다. 선택정보 또는 마케팅 수신 동의를 거부하더라도 기본 서비스 이용에는 불이익이 없습니다.`;

const patientSensitiveText = `AIMDNET은 의료진의 업무를 지원하는 AI 도구입니다.

환자의 성명, 주민등록번호, 연락처, 주소, 얼굴사진, 병원등록번호 등 직접 식별정보는 원칙적으로 입력하지 마십시오.

진단명, 증상, 병력, 검사결과, 처방정보, 진료기록 등 환자 건강정보를 입력하는 경우, 회원은 관련 법령, 환자 동의, 의료기관 내부 규정 또는 적법한 처리권한을 갖춘 경우에 한해 필요한 최소한의 정보만 입력해야 합니다.

회사는 식별 가능한 환자정보를 회원 또는 의료기관과의 별도 계약, 법령상 근거 또는 적법한 동의 없이 광고, 마케팅, 외부 판매 또는 외부 AI 모델 학습 목적으로 사용하지 않습니다.

AI가 제공하는 답변과 문서 초안은 참고자료이며, 최종 진료 판단과 환자에 대한 책임은 담당 의료진에게 있습니다.`;

const qualityImprovementText = `서비스 품질 개선을 위한 비식별·가명 처리 데이터 활용에 동의합니다. 식별 가능한 환자정보는 별도 동의 또는 별도 계약 없이 모델 학습·마케팅 목적으로 사용하지 않습니다.`;

const marketingText = `AIMDNET의 서비스 소식, 업데이트, 교육자료, 세미나, 이벤트 등 마케팅 정보 수신에 동의합니다. 선택 동의를 하지 않아도 기본 서비스 이용에는 제한이 없습니다.`;

function digits(value: string) {
  return value.replace(/\D/g, '');
}

function toggleList(arr: string[], value: string) {
  return arr.includes(value) ? arr.filter((item) => item !== value) : [...arr, value];
}

export default function LoginPage() {
  const router = useRouter();
  const [modalView, setModalView] = useState<ModalView>(null);
  const [loginLicense, setLoginLicense] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [accountType, setAccountType] = useState<'SEEKER' | 'DIRECTOR'>('SEEKER');
  const [jobTitle, setJobTitle] = useState('의사');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalType, setHospitalType] = useState('의원');
  const [hospitalRegion, setHospitalRegion] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [institutionNumber, setInstitutionNumber] = useState('');
  const [specialty, setSpecialty] = useState('내과');
  const [recruitWorkTypes, setRecruitWorkTypes] = useState<string[]>(['풀타임']);
  const [recruitWorkMethods, setRecruitWorkMethods] = useState<string[]>(['상근']);
  const [recruitWorkHours, setRecruitWorkHours] = useState('주 5일, 09:00~18:00');
  const [recruitPayMin, setRecruitPayMin] = useState('');
  const [recruitPayMax, setRecruitPayMax] = useState('');
  const [recruitIntro, setRecruitIntro] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [patientInfoAgreed, setPatientInfoAgreed] = useState(false);
  const [qualityImprovementAgreed, setQualityImprovementAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetNotice = () => {
    setMessage('');
    setError('');
  };

  const setAllAgreements = (checked: boolean) => {
    setTermsAgreed(checked);
    setPrivacyAgreed(checked);
    setPatientInfoAgreed(checked);
    setQualityImprovementAgreed(checked);
    setMarketingAgreed(checked);
  };

  const closeModal = () => {
    setModalView(null);
    setResetToken('');
    setNewPassword('');
    setNewPasswordConfirm('');
    resetNotice();
  };

  const saveSession = (data: any) => {
    localStorage.setItem('med_token', data.token);
    localStorage.setItem('med_user', JSON.stringify(data.user));
    router.push('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotice();
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber: digits(loginLicense), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다.');
      saveSession(data);
    } catch (err: any) {
      setError(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLicense = async () => {
    resetNotice();
    setLicenseVerified(false);
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/verify-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber: digits(licenseNumber), name, birthDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) throw new Error(data.reason || data.error || '면허번호 확인에 실패했습니다.');
      setLicenseVerified(true);
      setMessage('면허번호가 확인되었습니다. 회원가입을 진행할 수 있습니다.');
    } catch (err: any) {
      setError(err?.message || '면허번호 확인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotice();
    if (!termsAgreed || !privacyAgreed || !patientInfoAgreed) return setError('필수 약관, 개인정보 처리 안내, 환자정보·민감정보 입력 유의사항을 모두 확인해 주세요.');
    if (!licenseVerified) return setError('의사면허번호 확인을 먼저 완료해 주세요.');
    if (!name.trim()) return setError('이름을 입력해 주세요.');
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
    if (password !== passwordConfirm) return setError('비밀번호 확인이 일치하지 않습니다.');

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseNumber: digits(licenseNumber),
          name,
          password,
          birthDate,
          phone,
          telephone,
          email,
          address: [address1, address2].filter(Boolean).join(' '),
          accountType,
          jobTitle: accountType === 'DIRECTOR' && !jobTitle.trim() ? '병원 원장' : jobTitle,
          hospitalName,
          hospitalType,
          hospitalRegion,
          hospitalAddress,
          institutionNumber,
          specialty,
          recruitProfile: {
            locationAddress: accountType === 'DIRECTOR' ? (hospitalAddress || [address1, address2].filter(Boolean).join(' ')) : [address1, address2].filter(Boolean).join(' '),
            specialty,
            workTypes: recruitWorkTypes,
            workMethods: recruitWorkMethods,
            workHours: recruitWorkHours,
            minPay: recruitPayMin,
            maxPay: recruitPayMax,
            intro: recruitIntro,
          },
          termsAgreed,
          privacyAgreed,
          patientInfoAgreed,
          qualityImprovementAgreed,
          marketingAgreed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '회원가입에 실패했습니다.');
      saveSession(data);
    } catch (err: any) {
      setError(err?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetNotice();
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber: digits(loginLicense || licenseNumber) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '비밀번호 찾기 요청에 실패했습니다.');
      setMessage(data.resetToken ? `개발용 재설정 토큰: ${data.resetToken}` : data.message);
    } catch (err: any) {
      setError(err?.message || '비밀번호 찾기 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    resetNotice();
    if (!resetToken || newPassword.length < 8 || newPassword !== newPasswordConfirm) {
      setError('재설정 토큰과 일치하는 8자 이상 비밀번호를 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber: digits(loginLicense || licenseNumber), token: resetToken, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '비밀번호 변경에 실패했습니다.');
      setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
    } catch (err: any) {
      setError(err?.message || '비밀번호 재설정 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen w-full min-w-0 overflow-y-auto bg-[#eef3f8] text-[#222]">
      <section className="relative min-h-[360px] overflow-hidden bg-[#0b2754] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(76,201,240,0.24),transparent_24%),radial-gradient(circle_at_86%_12%,rgba(255,255,255,0.18),transparent_18%),linear-gradient(135deg,#0b2754_0%,#174f8e_48%,#0d7ea3_100%)]" />
        <div className="absolute left-[10%] top-[-40px] h-40 w-40 rotate-45 border border-white/10 bg-white/10" />
        <div className="absolute right-[12%] top-16 h-44 w-44 rotate-12 border border-white/10 bg-white/10" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#eef3f8] to-transparent" />
        <div className="relative mx-auto flex min-h-[320px] max-w-7xl flex-col justify-center px-6 py-12 lg:px-10">
          <p className="mb-4 text-sm font-bold tracking-[0.35em] text-cyan-100">CLINICAL INTELLIGENCE NETWORK</p>
          <h1 className="max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">AIMDNET Clinical AI Command Center</h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold text-blue-50">의약품 검색, DUR 안전성 검토, 진료 문서화와 임상 판단 보조를 하나로 연결하는 의료진 전용 AI 워크스페이스입니다.</p>
        </div>
      </section>

      <section id="login-panel" className="relative mx-auto -mt-16 max-w-7xl px-4 lg:px-8">
        <div className="grid overflow-hidden rounded-3xl border border-white bg-white shadow-2xl shadow-slate-300/60 lg:grid-cols-[1fr_440px]">
          <div className="hidden bg-[#f8fbff] p-10 lg:block">
            <p className="text-sm font-black text-[#1761a8]">의료진 인증 포털</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900">면허번호로 안전하게 접속하고, 검증된 의료진만 이용합니다.</h2>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <InfoCard title="License ID" desc="의사면허번호 기반 계정" />
              <InfoCard title="Policy" desc="약관·개인정보 동의 관리" />
              <InfoCard title="Secure" desc="의료진 전용 접근 제어" />
            </div>
          </div>
          <div className="bg-white px-6 py-10 sm:px-10">
            <h3 className="mb-6 text-2xl font-black text-slate-900">로그인</h3>
            <form onSubmit={handleLogin} className="w-full space-y-3">
            <label className="relative block">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">◎</span>
              <input value={loginLicense} onChange={(e) => setLoginLicense(digits(e.target.value))} className="h-12 w-full rounded-xl border border-[#d8d8d8] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1761a8] focus:ring-4 focus:ring-blue-100" placeholder="의사면허번호를 입력하세요" inputMode="numeric" required />
            </label>
            <label className="relative block">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">▣</span>
              <input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="h-12 w-full rounded-xl border border-[#d8d8d8] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1761a8] focus:ring-4 focus:ring-blue-100" placeholder="비밀번호를 입력하세요" type="password" required />
            </label>
            <button disabled={isLoading} className="h-12 w-full rounded-xl bg-[#123b7a] text-sm font-bold text-white transition hover:bg-[#0b2d60] disabled:bg-slate-300">{isLoading ? '로그인 중...' : '로그인'}</button>
          </form>
          {(error || message) && (
            <div className={`mt-4 border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {error || message}
            </div>
          )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <button onClick={() => { resetNotice(); setModalView('terms'); }} className="flex min-h-32 items-center gap-7 rounded-2xl border border-white bg-white px-8 text-left shadow-lg shadow-slate-200/70 transition hover:-translate-y-0.5 hover:border-[#1761a8] hover:shadow-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf4ff] text-3xl text-[#1761a8]">▣</span>
            <span>
              <strong className="block text-lg text-slate-900">회원가입</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-500">약관 동의 후 의사면허번호와 병원 정보를 입력합니다.</span>
            </span>
          </button>
          <button onClick={() => { resetNotice(); setModalView('forgot'); }} className="flex min-h-32 items-center gap-7 rounded-2xl border border-white bg-white px-8 text-left shadow-lg shadow-slate-200/70 transition hover:-translate-y-0.5 hover:border-[#1761a8] hover:shadow-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf4ff] text-3xl text-[#1761a8]">✎</span>
            <span>
              <strong className="block text-lg text-slate-900">아이디 비밀번호 찾기</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-500">면허번호로 계정을 찾고 비밀번호를 재설정합니다.</span>
            </span>
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-blue-100 bg-white px-6 py-4 text-xs leading-6 text-slate-600 shadow-sm">
          AIMDNET의 AI 답변은 의료진의 판단을 보조하기 위한 참고자료입니다. 진단, 처방, 투약, 검사, 시술 등 최종 의료행위는 담당 의료진의 독립적인 검토와 판단에 따라 이루어져야 합니다. 환자 식별정보 입력은 원칙적으로 금지되며, 불가피하게 환자정보를 입력하는 경우 관련 법령과 소속기관 규정을 준수해야 합니다.
        </div>
      </section>

      <footer className="mt-12 bg-[#1f2933] text-[#b8c0ca]">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs lg:px-8">
          <div className="flex flex-wrap gap-6 border-b border-white/10 pb-4">
            <span>회사소개</span><span>서비스소개</span><span>이용약관</span><span>개인정보보호정책</span><span>원격제어서비스</span>
          </div>
          <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-lg font-black text-white">AIMDNET</p>
              <p className="mt-2">주소 · 대표번호 · 고객지원</p>
            </div>
            <p>COPYRIGHT AIMDNET. ALL RIGHTS RESERVED.</p>
          </div>
        </div>
      </footer>

      {modalView === 'terms' && (
        <Modal title="회원가입 약관동의" onClose={closeModal} wide>
          <div className="space-y-6">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-[#123b7a]">AIMDNET 의료진 전용 AI 진료지원 플랫폼 가입 동의</p>
                  <p className="mt-1 text-xs text-slate-600">전체 동의에는 선택 동의가 포함됩니다. 선택 동의를 하지 않아도 기본 서비스 이용은 가능합니다.</p>
                </div>
                <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm">
                  <input type="checkbox" checked={termsAgreed && privacyAgreed && patientInfoAgreed && qualityImprovementAgreed && marketingAgreed} onChange={(e) => setAllAgreements(e.target.checked)} />
                  전체 동의
                </label>
              </div>
            </div>
            <AgreementBlock
              title="[필수] AIMDNET 서비스 이용약관"
              consentLabel="AIMDNET 서비스 이용약관에 동의합니다."
              checked={termsAgreed}
              onChange={setTermsAgreed}
              text={termsText}
            />
            <AgreementBlock
              title="[필수] 개인정보 처리 안내"
              consentLabel="개인정보 처리 안내를 확인했습니다."
              checked={privacyAgreed}
              onChange={setPrivacyAgreed}
              text={privacyText}
            />
            <AgreementBlock
              title="[필수] 환자정보·민감정보 입력 시 유의사항"
              consentLabel="환자정보·민감정보 입력 시 유의사항을 확인했습니다."
              checked={patientInfoAgreed}
              onChange={setPatientInfoAgreed}
              text={patientSensitiveText}
            />
            <ConsentCheck
              checked={qualityImprovementAgreed}
              onChange={setQualityImprovementAgreed}
              title="[선택] 서비스 품질 개선을 위한 비식별·가명 처리 데이터 활용"
              desc={qualityImprovementText}
            />
            <ConsentCheck
              checked={marketingAgreed}
              onChange={setMarketingAgreed}
              title="[선택] 마케팅 정보 수신"
              desc={marketingText}
            />
            <div className="border-t border-slate-200 pt-8 text-center">
              <button disabled={!termsAgreed || !privacyAgreed || !patientInfoAgreed} onClick={() => { resetNotice(); setModalView('form'); }} className={`${buttonBlue} w-40 disabled:bg-slate-300`}>확인</button>
              <button onClick={closeModal} className={`${buttonGray} ml-2 w-40`}>취소</button>
            </div>
          </div>
        </Modal>
      )}

      {modalView === 'form' && (
        <Modal title="회원가입 정보입력" onClose={closeModal} wide>
          <form onSubmit={handleSignup}>
            {(error || message) && (
              <div className={`mb-4 border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>
            )}
            <div className="border-t-2 border-[#2f80ed]">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
                <p className="mb-3 text-sm font-black text-slate-800">이용 목적</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setAccountType('SEEKER'); if (jobTitle === '병원 원장') setJobTitle('의사'); }}
                    className={`rounded-2xl border p-4 text-left ${accountType === 'SEEKER' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    <strong className="block text-sm">구직 의료진</strong>
                    <span className="mt-1 block text-xs leading-5">내 경력·희망조건을 저장하고 병원 추천을 받습니다.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAccountType('DIRECTOR'); if (!jobTitle || jobTitle === '의사') setJobTitle('병원 원장'); }}
                    className={`rounded-2xl border p-4 text-left ${accountType === 'DIRECTOR' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    <strong className="block text-sm">병원 원장/관리자</strong>
                    <span className="mt-1 block text-xs leading-5">병원정보와 채용 기준을 저장하고 후보 의료진 추천을 받습니다.</span>
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">아래 병원·매칭 정보는 모두 선택사항입니다. 지금 건너뛰고 가입 후 구인·구직 메뉴에서 다시 입력할 수 있습니다.</p>
              </div>
              <SignupRow label="아이디">
                <div className="flex gap-2">
                  <input value={licenseNumber} onChange={(e) => { setLicenseNumber(digits(e.target.value)); setLicenseVerified(false); }} className={`${inputClass} max-w-[190px]`} inputMode="numeric" required />
                  <button type="button" onClick={verifyLicense} disabled={isLoading || !licenseNumber || !name} className="h-9 bg-[#2f80ed] px-4 text-xs font-bold text-white disabled:bg-slate-300">면허확인</button>
                  {licenseVerified && <span className="self-center text-xs font-bold text-emerald-600">확인완료</span>}
                </div>
              </SignupRow>
              <SignupRow label="이름"><input value={name} onChange={(e) => { setName(e.target.value); setLicenseVerified(false); }} className={`${inputClass} max-w-[190px]`} required /></SignupRow>
              <SignupRow label="비밀번호"><input value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} max-w-[190px]`} type="password" required /></SignupRow>
              <SignupRow label="비밀번호확인"><input value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className={`${inputClass} max-w-[190px]`} type="password" required /></SignupRow>
              <SignupRow label="생년월일">
                <div className="flex items-center gap-2"><input value={birthDate} onChange={(e) => setBirthDate(digits(e.target.value).slice(0, 8))} className={`${inputClass} max-w-[190px]`} placeholder="YYYYMMDD" /><span className="text-xs text-slate-500">예) 19801004</span></div>
              </SignupRow>
              <SignupRow label="휴대폰번호"><input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} max-w-[250px]`} /></SignupRow>
              <SignupRow label="전화번호"><input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={`${inputClass} max-w-[250px]`} /></SignupRow>
              <SignupRow label="이메일"><input value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} max-w-[300px]`} type="email" /></SignupRow>
              <SignupRow label="주소">
                <div className="space-y-2">
                  <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={`${inputClass} max-w-[480px]`} placeholder={accountType === 'DIRECTOR' ? '대표자/계정 주소 또는 병원 주소' : '내 기준 위치 또는 주소'} />
                  <input value={address2} onChange={(e) => setAddress2(e.target.value)} className={`${inputClass} max-w-[480px]`} placeholder="상세주소(선택)" />
                </div>
              </SignupRow>
              <SignupRow label="직업"><input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className={`${inputClass} max-w-[300px]`} /></SignupRow>
              <SignupRow label={accountType === 'DIRECTOR' ? '병원명(선택)' : '현재/최근 병원명(선택)'}><input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className={`${inputClass} max-w-[300px]`} placeholder="건너뛰기 가능" /></SignupRow>
              {accountType === 'DIRECTOR' && (
                <>
                  <SignupRow label="병원 유형(선택)">
                    <select value={hospitalType} onChange={(e) => setHospitalType(e.target.value)} className={`${inputClass} max-w-[220px]`}>
                      {hospitalTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </SignupRow>
                  <SignupRow label="병원 지역(선택)"><input value={hospitalRegion} onChange={(e) => setHospitalRegion(e.target.value)} className={`${inputClass} max-w-[300px]`} placeholder="예: 서울 강남구" /></SignupRow>
                  <SignupRow label="병원 주소(선택)"><input value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} className={`${inputClass} max-w-[480px]`} placeholder="매칭 거리 계산에 사용됩니다. 건너뛰기 가능" /></SignupRow>
                </>
              )}
              <SignupRow label="진료과목">
                <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={`${inputClass} max-w-[220px]`}>
                  {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </SignupRow>
              <SignupRow label="요양기관번호"><input value={institutionNumber} onChange={(e) => setInstitutionNumber(e.target.value)} className={`${inputClass} max-w-[190px]`} /></SignupRow>
              <div className="bg-slate-50 px-4 py-4">
                <p className="text-sm font-black text-slate-800">{accountType === 'DIRECTOR' ? '매칭용 병원/채용 기준 입력(선택)' : '구직 선호조건 입력(선택)'}</p>
                <p className="mt-1 text-xs text-slate-500">선택 입력입니다. 건너뛰어도 가입할 수 있고, 이후 구인·구직 메뉴에서 수정할 수 있습니다.</p>
              </div>
              <SignupRow label={accountType === 'DIRECTOR' ? '채용 시간/형태' : '희망 시간/형태'}>
                <SmallCheckGroup values={recruitWorkTypes} options={signupWorkTypeOptions} onChange={setRecruitWorkTypes} />
              </SignupRow>
              <SignupRow label={accountType === 'DIRECTOR' ? '채용 업무 방식' : '희망 업무 방식'}>
                <SmallCheckGroup values={recruitWorkMethods} options={signupWorkMethodOptions} onChange={setRecruitWorkMethods} />
              </SignupRow>
              <SignupRow label={accountType === 'DIRECTOR' ? '채용 시간 상세' : '희망 근무시간'}><input value={recruitWorkHours} onChange={(e) => setRecruitWorkHours(e.target.value)} className={`${inputClass} max-w-[360px]`} placeholder="예: 주 5일 09:00~18:00" /></SignupRow>
              <SignupRow label={accountType === 'DIRECTOR' ? '제시 페이(선택)' : '희망 페이(선택)'}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={recruitPayMin} onChange={(e) => setRecruitPayMin(digits(e.target.value))} className={`${inputClass} max-w-[120px]`} placeholder="최소" />
                  <span className="text-xs text-slate-500">~</span>
                  <input value={recruitPayMax} onChange={(e) => setRecruitPayMax(digits(e.target.value))} className={`${inputClass} max-w-[120px]`} placeholder="최대" />
                  <span className="text-xs text-slate-500">만원</span>
                </div>
              </SignupRow>
              <SignupRow label={accountType === 'DIRECTOR' ? '병원/채용 소개' : '경력/희망사항'}>
                <textarea value={recruitIntro} onChange={(e) => setRecruitIntro(e.target.value)} className={`${inputClass} min-h-20 max-w-[480px] py-2`} placeholder="선택 입력 · 건너뛰기 가능" />
              </SignupRow>
            </div>
            <div className="mt-7 text-center">
              <button disabled={isLoading || !licenseVerified} className={`${buttonBlue} w-40`}>{isLoading ? '처리중...' : '확인'}</button>
              <button type="button" onClick={closeModal} className={`${buttonGray} ml-2 w-40`}>취소</button>
            </div>
          </form>
        </Modal>
      )}

      {modalView === 'forgot' && (
        <Modal title="아이디 비밀번호 찾기" onClose={closeModal}>
          <form onSubmit={requestPasswordReset} className="space-y-4">
            {(error || message) && <div className={`border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || message}</div>}
            <FormLabel label="의사면허번호"><input value={loginLicense} onChange={(e) => setLoginLicense(digits(e.target.value))} className={inputClass} inputMode="numeric" required /></FormLabel>
            <button disabled={isLoading} className={`${buttonBlue} w-full`}>{isLoading ? '요청 중...' : '비밀번호 재설정 요청'}</button>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-bold">재설정 토큰을 받은 경우</p>
              <div className="space-y-2">
                <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} className={inputClass} placeholder="재설정 토큰" />
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="새 비밀번호" type="password" />
                <input value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} className={inputClass} placeholder="새 비밀번호 확인" type="password" />
                <button type="button" onClick={resetPassword} className={`${buttonGray} w-full`}>비밀번호 변경</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className={`max-h-[92vh] overflow-auto border border-slate-200 bg-white shadow-2xl ${wide ? 'w-full max-w-[980px]' : 'w-full max-w-[520px]'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f8f8] px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-500 hover:text-slate-900">×</button>
        </div>
        <div className="p-6 sm:p-10">{children}</div>
      </div>
    </div>
  );
}

function AgreementBlock({ title, text, checked, onChange, consentLabel }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void; consentLabel: string }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-bold text-slate-700">- {title}</h3>
      <textarea readOnly value={text} className="h-40 w-full resize-none border border-[#d8d8d8] bg-white p-4 text-xs leading-6 text-slate-600" />
      <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
        <span>{consentLabel}</span>
      </label>
    </section>
  );
}

function ConsentCheck({ checked, onChange, title, desc }: { checked: boolean; onChange: (value: boolean) => void; title: string; desc: string }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <strong className="block text-slate-900">{title}</strong>
        <span className="mt-1 block leading-6 text-slate-600">{desc}</span>
      </span>
    </label>
  );
}

function SignupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[54px] grid-cols-[170px_1fr] border-b border-[#e5e5e5] text-sm">
      <div className="flex items-center justify-center bg-[#f1f2f6] font-bold text-slate-700">{label}</div>
      <div className="flex items-center px-3 py-2">{children}</div>
    </div>
  );
}

function SmallCheckGroup({ values, options, onChange }: { values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(toggleList(values, option))}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${values.includes(option) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-[#1761a8]">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{desc}</p>
    </div>
  );
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
}