const fs = require('fs');
let code = fs.readFileSync('e:/mediAI/src/app/dashboard/page.tsx', 'utf8');

const snippet = };

const LOCALIZED_FORMS: Record<string, any> = {
  '영어': {
    intakeTitle: "Please enter your symptoms to share with the doctor.",
    q1: "Q. What are your main symptoms? (Chief complaint)", p1: "e.g., Headache and fever...",
    q2: "Q. When did the symptoms start?", p2: "e.g., 3 days ago",
    q3: "Q. Are you taking any medications or do you have underlying conditions?", p3: "e.g., Taking blood pressure medication",
    q4: "Q. What is your occupation?", p4: "e.g., Office worker",
    submit: "Submit to Doctor", submitted: "Intake form submitted.", submittedDesc: "The information will be summarized for the doctor.", retry: "Rewrite",
    consentTitle: "Consent Form for Treatment and Non-covered Procedures",
    consentText: "1. I have heard sufficient explanation from the attending physician regarding the diagnosis, purpose of the procedure, expected progress, side effects, and alternative treatment options.\\n2. I understand that unexpected complications may occur even if the medical staff does their best.",
    signHere: "Signature", clear: "Clear", save: "Save Signature", signing: "Signed",
    summaryTitle: "Summary & Medication Guide", generateSummary: "Generate Summary"
  },
  '중국어': {
    intakeTitle: "请输入您要告诉医生的症状。",
    q1: "Q. 您哪里不舒服？（主诉）", p1: "例：头痛发热...",
    q2: "Q. 症状从什么时候开始的？", p2: "例：3天前",
    q3: "Q. 您在服用什么药物或有基础疾病吗？", p3: "例：服用高血压药",
    q4: "Q. 您的职业是什么？", p4: "例：上班族",
    submit: "提交并发送给医生", submitted: "问诊表已提交。", submittedDesc: "提交的信息将在诊疗时汇总显示在医生屏幕上。", retry: "重新填写",
    consentTitle: "手术及非医保诊疗同意书",
    consentText: "1. 本人已从主治医生处充分听取了关于诊断、手术目的、预期进展及副作用、可替代治疗方法等的说明。\\n2. 本人理解即使医疗团队尽最大努力，也可能发生意想不到的并发症。",
    signHere: "签名栏 (Signature)", clear: "清除", save: "保存签名", signing: "签名完成",
    summaryTitle: "多语言患者诊疗摘要和用药指导", generateSummary: "生成摘要"
  },
  '일본어': {
    intakeTitle: "医師に伝える症状を入力してください。",
    q1: "Q. どこが具合が悪いですか？（主訴）", p1: "例：頭痛や熱があります...",
    q2: "Q. 症状はいつから始まりましたか？", p2: "例：3日前から",
    q3: "Q. 服用中の薬や持病はありますか？", p3: "例：高血圧の薬を服用中",
    q4: "Q. 職業は何ですか？", p4: "例：会社員",
    submit: "送信して医師に伝える", submitted: "問診票が送信されました。", submittedDesc: "送信された情報は、診察時に医師の画面に要約して表示されます。", retry: "再入力する",
    consentTitle: "施術および自由診療同意書",
    consentText: "1. 私は担当医から診断、施術の目的、予想される経過および副作用、代替可能な治療法などについて十分な説明を受けました。\\n2. 私は、医療スタッフが最善を尽くしても予期せぬ合併症が発生する可能性があることを理解しています。",
    signHere: "署名欄 (Signature)", clear: "消去", save: "署名保存", signing: "署名完了",
    summaryTitle: "多言語患者診療要約および服薬指導", generateSummary: "要約生成"
  },
  '러시아어': {
    intakeTitle: "Пожалуйста, введите ваши симптомы для врача.",
    q1: "В. На что жалуетесь? (Основная жалоба)", p1: "напр., Болит голова и температура...",
    q2: "В. Когда начались симптомы?", p2: "напр., 3 дня назад",
    q3: "В. Принимаете ли вы какие-либо лекарства или есть ли у вас хронические заболевания?", p3: "напр., Принимаю лекарства от давления",
    q4: "В. Кем вы работаете?", p4: "напр., Офисный работник",
    submit: "Отправить врачу", submitted: "Анкета отправлена.", submittedDesc: "Информация будет обобщена для врача.", retry: "Заполнить заново",
    consentTitle: "Форма согласия на лечение и платные процедуры",
    consentText: "1. Я выслушал(а) достаточное объяснение от лечащего врача о диагнозе, цели процедуры, ожидаемом течении, побочных эффектах и альтернативных методах лечения.\\n2. Я понимаю, что неожиданные осложнения могут возникнуть, даже если медицинский персонал сделает всё возможное.",
    signHere: "Подпись", clear: "Очистить", save: "Сохранить подпись", signing: "Подписано",
    summaryTitle: "Краткое изложение и инструкции по приему лекарств", generateSummary: "Создать сводку"
  },
  '베트남어': {
    intakeTitle: "Vui lòng nhập triệu chứng của bạn để thông báo cho bác sĩ.",
    q1: "H. Bạn cảm thấy khó chịu ở đâu? (Triệu chứng chính)", p1: "VD: Đau đầu và bị sốt...",
    q2: "H. Triệu chứng bắt đầu từ khi nào?", p2: "VD: 3 ngày trước",
    q3: "H. Bạn có đang dùng thuốc hay có bệnh lý nền nào không?", p3: "VD: Đang dùng thuốc huyết áp",
    q4: "H. Nghề nghiệp của bạn là gì?", p4: "VD: Nhân viên văn phòng",
    submit: "Gửi cho Bác sĩ", submitted: "Phiếu khám đã được gửi.", submittedDesc: "Thông tin sẽ được tóm tắt trên màn hình của bác sĩ.", retry: "Viết lại",
    consentTitle: "Mẫu Chấp thuận Điều trị và Dịch vụ Không Bảo hiểm",
    consentText: "1. Tôi đã nghe giải thích đầy đủ từ bác sĩ về chẩn đoán, mục đích của quy trình, tiến triển dự kiến, tác dụng phụ và các phương pháp điều trị thay thế.\\n2. Tôi hiểu rằng các biến chứng không lường trước có thể xảy ra ngay cả khi nhân viên y tế đã cố gắng hết sức.",
    signHere: "Chữ ký", clear: "Xóa", save: "Lưu Chữ ký", signing: "Đã ký",
    summaryTitle: "Bản tóm tắt & Hướng dẫn sử dụng thuốc", generateSummary: "Tạo tóm tắt"
  },
  '몽골어': {
    intakeTitle: "Эмчид мэдэгдэх шинж тэмдгээ оруулна уу.",
    q1: "А. Танд хаана эвгүй байна вэ? (Гол зовуурь)", p1: "Ж.нь: Толгой өвдөж, халуурч байна...",
    q2: "А. Шинж тэмдэг хэзээнээс эхэлсэн бэ?", p2: "Ж.нь: 3 хоногийн өмнөөс",
    q3: "А. Та ямар нэгэн эм ууж байгаа юу, эсвэл суурь өвчтэй юу?", p3: "Ж.нь: Цусны даралтын эм ууж байгаа",
    q4: "А. Таны мэргэжил/ажил юу вэ?", p4: "Ж.нь: Оффисын ажилтан",
    submit: "Эмчид илгээх", submitted: "Асуумж илгээгдлээ.", submittedDesc: "Мэдээллийг эмчийн дэлгэц дээр хураангуйлан харуулах болно.", retry: "Дахин бичих",
    consentTitle: "Эмчилгээ, төлбөртэй үйлчилгээний зөвшөөрлийн хуудас",
    consentText: "1. Би эмчээс онош, ажилбарын зорилго, хүлээгдэж буй явц, гаж нөлөө болон эмчилгээний өөр хувилбаруудын талаар хангалттай тайлбар сонссон.\\n2. Эмнэлгийн ажилтнууд бүх хүчээ дайчилсан ч гэнэтийн хүндрэл гарч болзошгүйг би ойлгож байна.",
    signHere: "Гарын үсэг", clear: "Устгах", save: "Гарын үсэг хадгалах", signing: "Гарын үсэг зурсан",
    summaryTitle: "Хураангуй болон эмийн заавар", generateSummary: "Хураангуй үүсгэх"
  },
  '한국어': {
    intakeTitle: "의사에게 전달할 증상을 입력해주세요.",
    q1: "Q. 어디가 불편하신가요? (주호소)", p1: "예: 머리가 아프고 열이 납니다...",
    q2: "Q. 증상이 언제부터 시작되었나요?", p2: "예: 3일 전부터",
    q3: "Q. 복용 중인 약이나 기저질환이 있나요?", p3: "예: 고혈압 약 복용중",
    q4: "Q. 직업은 무엇인가요? (직장)", p4: "예: 사무직",
    submit: "제출 및 원장님께 전송", submitted: "문진표가 제출되었습니다.", submittedDesc: "제출된 정보는 진료 시 원장님 화면에 요약되어 표기됩니다.", retry: "다시 작성하기",
    consentTitle: "시술 및 비급여 진료 동의서",
    consentText: "1. 본인은 담당 의사로부터 진단, 시술 목적, 예상되는 경과 및 부작용, 대체 가능한 치료 방법 등에 대해 충분한 설명을 들었습니다.\\n2. 본인은 의료진이 최선을 다하더라도 예상치 못한 합병증이 발생할 수 있음을 이해합니다.",
    signHere: "서명란 (Signature)", clear: "지우기", save: "서명 저장", signing: "서명 완료",
    summaryTitle: "다국어 환자 진료 요약 & 복약지도", generateSummary: "요약문 생성"
  }
};

code = code.replace(/};\s*(?=(?:\r?\n)*export default function Dashboard\(\))/g, snippet + '\n\n');
fs.writeFileSync('e:/mediAI/src/app/dashboard/page.tsx', code, 'utf8');
