// Unified Chat Mode
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const imageUpload = document.getElementById('imageUpload');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

const viewSearch = document.getElementById('welcomeView');
const chatFlowContainer = document.getElementById('chatFlowContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const scrollArea = document.getElementById('scrollArea');

const translationDashboard = document.getElementById('translationDashboard');
const loginOverlay = document.getElementById('loginOverlay');
const doLoginBtn = document.getElementById('doLoginBtn');
const docNameDisplay = document.getElementById('docNameDisplay');
const personalizedSuggestions = document.getElementById('personalizedSuggestions');
const transInput = document.getElementById('transInput');
const transTargetLang = document.getElementById('transTargetLang');
const transOutput = document.getElementById('transOutput');
const doTranslateBtn = document.getElementById('doTranslateBtn');

// Global State Variables
let currentChatHistory = [];
let currentImageBase64 = null;
let isThinking = false;
let currentDepth = 0;
let lastResultPayload = null;
let currentSessionId = 'session_' + Date.now();
let currentRagContext = null;
const libraryView = null; // Removed view
const saveLibraryBtn = document.getElementById('saveLibraryBtn');

// Login Logic
if(doLoginBtn) {
    doLoginBtn.addEventListener('click', () => {
        const nameEl = document.getElementById('docName') || document.getElementById('licenseNum');
        const docName = (nameEl ? nameEl.value : '') || '원장';
        
        const specEl = document.getElementById('docSpecialty') || document.getElementById('specialtySelect');
        const docSpec = (specEl ? specEl.value : '') || '일반의';
        
        if (docNameDisplay) {
            docNameDisplay.innerText = `${docName} 원장님 (${docSpec})`;
        }
        setupSuggestions(docSpec);
        
        loginOverlay.style.display = 'none';
        
        // Add fake user avatar or auth token logic visually
        alert(`로그인 성공:\n전문의 모드로 전환되었습니다.\n[인가된 과목: ${docSpec}]`);
    });
}

function setupSuggestions(spec) {
    if(!personalizedSuggestions) return;
    let html = '';
    if(spec === '내과') {
        html = `
            <button class="suggestion-btn" onclick="fillSearch('2형 당뇨 1차 처방 최신 가이드라인')">당뇨 1차 처방 가이드</button>
            <button class="suggestion-btn" onclick="fillSearch('고혈압 약제 동시 처방 주의사항')">고혈압 DDI 체크</button>
        `;
    } else if(spec === '피부과') {
        html = `
            <button class="suggestion-btn" onclick="fillSearch('여드름 이소트레티노인 부작용 및 설명')">이소트레티노인 설명</button>
            <button class="suggestion-btn" onclick="fillSearch('아토피 피부염 최신 초진 가이드')">아토피 초진 팁</button>
        `;
    } else {
        html = `
            <button class="suggestion-btn" onclick="fillSearch('상기도 감염 항생제 처방 기준 알려줘')">감기 항생제 가이드</button>
            <button class="suggestion-btn" onclick="fillSearch('소화불량 위장약 조합 추천해줘')">위장약 조합</button>
            <button class="suggestion-btn" onclick="fillSearch('첨부한 X-ray 사진 판독해줘')">X-ray 판독</button>
            <button class="suggestion-btn" onclick="fillSearch('요즘 강남 내과 알바 자리 벤치마크할 것 찾아줘')">초빙/구직 검색</button>
        `;
    }
    personalizedSuggestions.innerHTML = html;
}

window.renderInteractiveDrugTable = function(tableId, sortColumn = null, isAsc = true) {
    const container = document.getElementById(tableId);
    if (!container) return;
    
    let drugs = window[`drugData_${tableId}`];
    if (!drugs || !Array.isArray(drugs)) {
        container.innerHTML = '<p>약물 정보가 없습니다.</p>';
        return;
    }

    if (sortColumn) {
        drugs.sort((a, b) => {
            const valA = String(a[sortColumn] || '').normalize();
            const valB = String(b[sortColumn] || '').normalize();
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });
    }

    const nextDirection = !isAsc;

    let tableHtml = `
        <table style="width:100%; border-collapse: collapse; text-align: left; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <thead style="background:var(--primary); color:white; font-size:0.9rem;">
                <tr>
                    <th style="padding:10px; cursor:pointer;" onclick="renderInteractiveDrugTable('${tableId}', 'name', ${nextDirection})">제품명 ${sortColumn==='name'?(isAsc?'▲':'▼'):'↕'}</th>
                    <th style="padding:10px; cursor:pointer;" onclick="renderInteractiveDrugTable('${tableId}', 'ingredient', ${nextDirection})">성분명 ${sortColumn==='ingredient'?(isAsc?'▲':'▼'):'↕'}</th>
                    <th style="padding:10px; cursor:pointer;" onclick="renderInteractiveDrugTable('${tableId}', 'price', ${nextDirection})">약가/구분 ${sortColumn==='price'?(isAsc?'▲':'▼'):'↕'}</th>
                    <th style="padding:10px; cursor:pointer;" onclick="renderInteractiveDrugTable('${tableId}', 'company', ${nextDirection})">제약사 ${sortColumn==='company'?(isAsc?'▲':'▼'):'↕'}</th>
                </tr>
            </thead>
            <tbody style="font-size:0.85rem; color:#333;">
    `;

    drugs.forEach(d => {
        tableHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;">
                <td style="padding:10px; font-weight:600; color:var(--primary);">${d.name}</td>
                <td style="padding:10px; color:#64748b;">${d.ingredient}</td>
                <td style="padding:10px;">${d.price || '미상'}<br><span style="font-size:0.75rem; color:#94a3b8;">${d.class || '전문의약품'}</span></td>
                <td style="padding:10px; color:#475569;"><i class="fa-regular fa-building"></i> ${d.company || '제약사'}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
};

// ---------------------------------
// View Toggling Logic
// ---------------------------------
function switchToChat() {
    closeSidebarOnMobile();
    if(document.getElementById('translationDashboard')) document.getElementById('translationDashboard').classList.add('hidden');
    
    // Show input dock
    const inputDockWrapper = document.querySelector('.input-dock-wrapper');
    if(inputDockWrapper) inputDockWrapper.style.display = 'block';

    if(currentChatHistory.length === 0) {
        viewSearch.classList.remove('hidden');
        chatFlowContainer.classList.add('hidden');
    } else {
        viewSearch.classList.add('hidden');
        chatFlowContainer.classList.remove('hidden');
    }
}

function switchToTranslation() {
    closeSidebarOnMobile();
    viewSearch.classList.add('hidden');
    chatFlowContainer.classList.add('hidden');
    if(libraryView) libraryView.classList.add('hidden');
    const td = document.getElementById('translationDashboard');
    if(td) td.classList.remove('hidden');

    // Hide input dock when in translation
    const inputDockWrapper = document.querySelector('.input-dock-wrapper');
    if(inputDockWrapper) inputDockWrapper.style.display = 'none';
}

if(doTranslateBtn) {
    doTranslateBtn.addEventListener('click', async () => {
        const text = transInput.value.trim();
        const lang = transTargetLang.value;
        if(!text) return;
        
        doTranslateBtn.innerText = '번역 중...';
        doTranslateBtn.disabled = true;
        
        try {
            const apiRes = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: `다음 내용을 ${lang}로 의학적 뉘앙스를 살려서 환자/보호자가 이해하기 쉽게 번역해줘:\n"${text}"`,
                    history: []
                })
            });
            const data = await apiRes.json();
            
            // new logic: parse from blocks if translation was returned as blocks
            let transText = '';
            let noteText = '';
            if (data.blocks && data.blocks.length > 0) {
                 const tBlock = data.blocks.find(b => b.block_type === 'translation');
                 if (tBlock) {
                     transText = tBlock.body;
                     noteText = tBlock.meta_json?.clinical_note || '';
                 }
            } else if (data.translation_info) {
                 transText = data.translation_info.translated_text;
                 noteText = data.translation_info.clinical_note;
            } else {
                 transText = data.chat_reply || '번역 결과를 가져오지 못했습니다.';
            }

            transOutput.value = transText;
            const note = document.getElementById('transNoteAlert');
            if(noteText) {
                note.style.display = 'block';
                note.innerHTML = `<strong>주의사항:</strong> ${noteText}`;
            } else {
                note.style.display = 'none';
            }
        } catch(e) {
            transOutput.value = "번역 중 오류가 발생했습니다.";
        }
        
        doTranslateBtn.innerHTML = '<i class="fa-solid fa-language"></i> 의학 번역 실행';
        doTranslateBtn.disabled = false;
    });
}

function startNewChat() {
    switchToChat();
    currentSessionId = Date.now().toString();
    viewSearch.classList.remove('hidden');
    chatFlowContainer.classList.add('hidden');
    chatFlowContainer.innerHTML = '';
    if (libraryView) libraryView.classList.add('hidden');
    if (saveLibraryBtn) saveLibraryBtn.classList.add('hidden');
    
    document.getElementById('modeTitle').innerText = "전문 의학 어시스턴트";
    document.getElementById('modeDesc-header').innerText = "진료, 연구, 약물 보조는 물론 상황에 맞춘 대화를 지원합니다.";
    
    searchInput.value = '';
    clearImage();
    currentChatHistory = [];
}

function showLibrary() {
    viewSearch.classList.add('hidden');
    chatFlowContainer.classList.add('hidden');
    if(libraryView) libraryView.classList.remove('hidden');
    if(saveLibraryBtn) saveLibraryBtn.classList.add('hidden');

    document.getElementById('modeTitle').innerText = "내 라이브러리";
    document.getElementById('modeDesc-header').innerText = "저장된 중요 레퍼런스와 스크립트를 모아보는 공간입니다.";
    renderLibrary();
}

function fillSearch(text) {
    closeSidebarOnMobile();
    searchInput.value = text;
    handleSearch();
}

function clearImage() {
    currentImageBase64 = null;
    imageUpload.value = '';
    imagePreview.src = '';
    imagePreviewContainer.classList.add('hidden');
}

document.getElementById('newChatBtn').addEventListener('click', startNewChat);

imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentRagContext = ev.target.result;
            currentImageBase64 = ev.target.result;
            imagePreview.src = currentImageBase64;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', clearImage);

function appendUserMessage(text, imageBase64) {
    const row = document.createElement('div');
    row.className = 'msg-wrapper user-msg';
    
    let imgHtml = '';
    if (imageBase64) {
        imgHtml = `<img src="${imageBase64}" class="user-img" alt="첨부">`;
    }

    row.innerHTML = `
        <div class="user-bubble">
            ${text ? `<div>${text.replace(/\n/g, '<br>')}</div>` : ''}
            ${imgHtml}
        </div>
    `;
    
    chatFlowContainer.appendChild(row);
    scrollArea.scrollTo({top: scrollArea.scrollHeight, behavior: 'smooth'});
}

function appendAIMessage(data) {
    const row = document.createElement('div');
    row.className = 'msg-wrapper ai-msg';
    row.style.marginBottom = "2rem";

    let contentHtml = '';
    
    // 번역 대시보드 로직 (translationDashboard의 transOutput)의 경우
    // API에서 blocks 대신 직접 줄 수도 있음. 또는 일반 대화로 왔을경우 방어.
    
    const intent = data.intent_type || 'general';
    const blocks = data.blocks || [];

    // Header based on Intent
    if (intent === 'disease') {
        contentHtml += `<div class="module-chip chip-disease"><i class="fa-solid fa-stethoscope"></i> 질환/지식 검색 모듈</div>`;
    } else if (intent === 'drug') {
        contentHtml += `<div class="module-chip chip-drug"><i class="fa-solid fa-pills"></i> 약품/처방 인텔리전스</div>`;
    } else if (intent === 'image') {
        contentHtml += `<div class="module-chip chip-image" style="display:inline-block; padding:5px 10px; background:#e0f2fe; color:#1e40af; border-radius:15px; font-size:0.8rem; font-weight:bold; margin-bottom:10px;"><i class="fa-solid fa-image"></i> 영상/판독 보조 인텔리전스</div>`;
    } else if (intent === 'recruit') {
        contentHtml += `<div class="module-chip chip-recruit" style="display:inline-block; padding:5px 10px; background:#f3e8ff; color:#6b21a8; border-radius:15px; font-size:0.8rem; font-weight:bold; margin-bottom:10px;"><i class="fa-solid fa-user-doctor"></i> 초빙/구직 AI 매칭</div>`;
    } else if (intent === 'translation') {
        contentHtml += `<div class="module-chip chip-translation"><i class="fa-solid fa-earth-americas"></i> 진료실 번역 모듈</div>`;
    }

    blocks.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach(block => {
        const type = block.block_type;
        const title = block.title || '';
        const body = block.body ? block.body.replace(/\n/g, '<br>') : '';
        const meta = block.meta_json || {};

        if (type === 'textbook') {
            contentHtml += `
                <div class="tier-card tier-textbook">
                    <h3><i class="fa-solid fa-book-open"></i> Textbook Knowledge (근거 기반 확정 지식)</h3>
                    <div style="font-weight:bold; margin-bottom:8px;">${title}</div>
                    <div>${body}</div>
                </div>
            `;
        } else if (type === 'journal') {
            contentHtml += `
                <div class="tier-card tier-journal" style="background:#f0fdf4; border:1px solid #bbf7d0; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <h3 style="color:#166534;"><i class="fa-solid fa-microscope"></i> Latest Journals (최신 논문 및 가이드라인)</h3>
                    <div style="font-weight:bold; margin-bottom:8px;">${title}</div>
                    <div>${body}</div>
                </div>
            `;
        } else if (type === 'md_tip') {
            contentHtml += `
                <div class="tier-card tier-mdtips" style="background:#fdf4ff; border:1px solid #e9d5ff; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <h3 style="color:#6b21a8;"><i class="fa-solid fa-user-doctor"></i> MD 실무 Tip <span style="background:#ef4444; color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:5px;">⚠️ 참고용</span></h3>
                    <div style="font-weight:bold; margin-bottom:8px;">${title}</div>
                    <div>${body}</div>
                </div>
            `;
        } else if (type === 'doctor_consensus') {
            contentHtml += `
                <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <h3 style="color:#1d4ed8; font-size:1rem; margin-bottom:10px;"><i class="fa-solid fa-users-viewfinder"></i> 의사 집단 반응 요약 (AI 집계)</h3>
                    <div style="display:flex; gap:15px; margin-bottom:12px; font-size:0.9rem;">
                        <span style="color:#166534;"><i class="fa-solid fa-thumbs-up"></i> 좋아요 ${meta.like_count || 0}</span>
                        <span style="color:#b91c1c;"><i class="fa-solid fa-thumbs-down"></i> 싫어요 ${meta.dislike_count || 0}</span>
                        <span style="color:#475569;"><i class="fa-solid fa-comment-dots"></i> 의견 ${meta.feedback_count || 0}</span>
                    </div>
                    <div style="background:#fff; padding:10px; border-radius:6px; font-size:0.9rem; color:#334155; line-height:1.5;">
                        <strong style="color:#1e293b;">합의 요약:</strong> ${meta.summary || body}
                    </div>
                </div>
            `;
        } else if (type === 'doctor_opinion') {
            let opinionsHtml = '';
            const opinions = meta.opinions || [];
            if(opinions.length > 0) {
                opinionsHtml = opinions.map(op => `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-weight:bold; font-size:0.85rem; color:var(--primary);"><i class="fa-solid fa-user-md"></i> ${op.specialty || '전문의'}</span>
                            <span style="font-size:0.8rem; color:#64748b;"><i class="fa-regular fa-thumbs-up"></i> ${op.likes || 0}</span>
                        </div>
                        <div style="font-size:0.9rem; color:#333;">${op.content || op.opinion_text}</div>
                    </div>
                `).join('');
            }
            contentHtml += `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <h3 style="color:#475569; font-size:0.95rem; margin-bottom:10px;"><i class="fa-solid fa-comments"></i> 의사 의견 <span style="background:#ef4444; color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:5px;">참고용</span></h3>
                    ${opinionsHtml}
                    <button style="width:100%; border:1px dashed #94a3b8; background:transparent; padding:8px; border-radius:6px; color:#475569; margin-top:5px; cursor:pointer;" onclick="openOpinionModal(Date.now().toString())">+ 내 의견 남기기</button>
                </div>
            `;
        } else if (type === 'insurance_warning') {
            contentHtml += `
                <div style="margin-top: 1rem; padding-left: 1rem; border-left: 3px solid #f59e0b; color: #b45309; font-size: 0.9rem; background: #fffcf2; padding: 10px; border-radius: 8px; margin-bottom:12px;">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> [DDI / 보험 삭감 경고] ${title}</strong><br><br>
                    ${body}
                </div>
            `;
        } else if (type === 'expert_warning') {
             contentHtml += `
                <div style="margin-top: 1rem; padding-left: 1rem; border-left: 3px solid #ef4444; color: #b91c1c; font-size: 0.9rem; background: #fef2f2; padding: 10px; border-radius: 8px; margin-bottom:12px;">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> [전문가 검토 필요] 확신도 낮음</strong><br>
                    ${body}
                </div>
            `;
        } else if (type === 'image_read' || type === 'ddx') {
             contentHtml += `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:10px; margin-bottom:12px;">
                    <strong style="color:#0f172a; font-size:1rem; display:block; margin-bottom:8px;">${title}</strong>
                    <div>${body}</div>
                </div>
            `;
        } else if (type === 'sponsor_card') {
            contentHtml += `
                <div class="sponsor-ad-box" style="margin-top:15px; background:#fff1f2; border:1px solid #fecdd3; padding:12px; border-radius:8px; cursor:pointer;" onclick="window.open('${meta.link_url||'#'}', '_blank')">
                    <strong style="color:#be123c; display:block; margin-bottom:5px;"><i class="fa-solid fa-rectangle-ad"></i> [제약/의료기기 Sponsor] ${meta.card_title || title}</strong>
                    <span style="color:#881337; font-size:0.85rem;">${body || '관련 질환에 추천되는 맞춤 포럼/제품 브로셔를 확인해보세요.'}</span>
                </div>
            `;
        } else if (type === 'recruit_cards') {
            let jobsHtml = '';
            const jobs = meta.jobs || [];
            if(jobs.length > 0) {
                jobsHtml = jobs.map(j => `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <strong style="color:var(--primary); font-size:1rem;">${j.title}</strong>
                            <span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">AI Match: ${j.match_score||'90%'}</span>
                        </div>
                        <div style="color:#64748b; font-size:0.85rem; margin-top:5px;"><i class="fa-solid fa-hospital"></i> ${j.hospital} | ${j.type}</div>
                        <div style="color:#333; font-size:0.85rem; margin-top:5px;">${j.detail}</div>
                    </div>
                `).join('');
            }
            contentHtml += `
                <div style="margin-bottom:12px;">
                    <h3 style="font-size:1rem; color:#475569; margin-bottom:10px;">${title || 'AI 맞춤 초빙 리스트'}</h3>
                    ${jobsHtml}
                </div>
            `;
        } else if (type === 'drug_cards') {
            let uniqueDrugId = `drug-table-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            const drugs = meta.drugs || [];
            window[`drugData_${uniqueDrugId}`] = drugs;

            contentHtml += `
                <div class="drug-container">
                    <div style="font-size:0.85rem; color:#64748b; margin-bottom:10px; display:flex; justify-content:space-between;">
                        <span>${title || '의학 엔진 검색 반영 (테이블 헤더 클릭 시 정렬 가능)'}</span>
                    </div>
                    <div id="${uniqueDrugId}" class="real-drug-table">
                    </div>
                </div>
            `;
            setTimeout(() => {
                if (window.renderInteractiveDrugTable) window.renderInteractiveDrugTable(uniqueDrugId, null, true);
            }, 100);
        } else {
             // Fallback for general text
             contentHtml += `<div style="margin-bottom:10px;"><strong>${title}</strong><br>${body}</div>`;
        }
    });

    // 만약 data에 그냥 chat_reply만 들어왔을때 방어용 (Fallback)
    if(blocks.length === 0) {
        if(data.chat_reply) {
            contentHtml += data.chat_reply.replace(/\n/g, '<br>');
        } else if(data.translation_info) {
             contentHtml += `
              <div class="trans-box">${data.translation_info.translated_text}</div>
              <div class="trans-note"><i class="fa-solid fa-circle-info"></i> <b>Clinical Note:</b> ${data.translation_info.clinical_note}</div>
          `;
        } else if(typeof data.result === 'string') {
             contentHtml += data.result;
        } else {
             contentHtml += "AI 응답을 분석할 수 없습니다.";
        }
    }

    row.innerHTML = `
        <div class="ai-bubble">
            <div class="ai-icon">
                <img src="/logo.png" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 512 512\\'><path fill=\\'%232563eb\\' d=\\'M96 352V96c0-35.3 28.7-64 64-64H416c35.3 0 64 28.7 64 64V293.5c0 17-6.7 33.3-18.7 45.3l-58.5 58.5c-12 12-28.3 18.7-45.3 18.7H160c-35.3 0-64-28.7-64-64zM272 128c-8.8 0-16 7.2-16 16v48H208c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h48v48c0 8.8 16 7.2 16 16h32c0-8.8 16-7.2 16-16v-48h48c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16h-48v-48c0-8.8-7.2-16-16-16H272zM48 246.6C16.9 259.2 0 288.8 0 320v96c0 53 43 96 96 96H384c31.2 0 60.8-16.9 73.4-48H96c-26.5 0-48-21.5-48-48V246.6z\\'/></svg>'">
            </div>
            <div class="ai-content" style="width:100%;">
                <div style="font-weight: 600; font-size: 0.85rem; color: #64748b; margin-bottom: 12px;"><i class="fa-solid fa-bolt"></i> ${data.orchestration_summary || data.inferred_domain || 'AI 분석 완료'}</div>
                ${contentHtml}
                
                <div class="response-action-bar" style="display:flex; gap:10px; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px; flex-wrap:wrap;">
                    <button style="border:1px solid #cbd5e1; background:white; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; color:#475569;" onclick="alert('저장되었습니다.')"><i class="fa-regular fa-bookmark"></i> 저장</button>
                    <button style="border:1px solid #cbd5e1; background:white; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; color:#475569;" onclick="alert('클립보드에 복사되었습니다.')"><i class="fa-regular fa-copy"></i> 복사</button>
                    <div style="flex:1;"></div>
                    <button style="border:1px solid #bbf7d0; background:#f0fdf4; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; color:#166534;" onclick="this.innerHTML='<i class=\\'fa-solid fa-thumbs-up\\'></i> 좋아요 반영됨'"><i class="fa-regular fa-thumbs-up"></i> 좋아요</button>
                    <button style="border:1px solid #fecdd3; background:#fff1f2; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; color:#be123c;" onclick="this.innerHTML='<i class=\\'fa-solid fa-thumbs-down\\'></i> 싫어요 반영됨'"><i class="fa-regular fa-thumbs-down"></i> 싫어요</button>
                    <button style="border:none; background:var(--primary); padding:6px 15px; border-radius:15px; font-size:0.8rem; cursor:pointer; color:white; font-weight:bold;" onclick="openOpinionModal(Date.now().toString())"><i class="fa-solid fa-comment-medical"></i> 내 의견 남기기</button>
                </div>
            </div>
        </div>
    `;

    chatFlowContainer.appendChild(row);
    scrollArea.scrollTo({top: scrollArea.scrollHeight, behavior: 'smooth'});
}

async function handleSearch() {
    if (isThinking) return;
    const val = searchInput.value.trim();
    if(!val && !currentImageBase64) return;

    isThinking = true;
    searchInput.disabled = true;
    searchBtn.disabled = true;

    viewSearch.classList.add('hidden');
    chatFlowContainer.classList.remove('hidden');

    // Append user message to UI
    appendUserMessage(val, currentImageBase64);

    chatFlowContainer.appendChild(loadingIndicator);
    loadingIndicator.classList.remove('hidden');
    scrollArea.scrollTo({top: scrollArea.scrollHeight, behavior: 'smooth'});

    // Save inputs before clearing
    const savedVal = val;
    const savedImage = currentImageBase64;
    const savedRag = currentRagContext;

    // Clear inputs immediately for better UX
    searchInput.value = '';
    clearImage();    try {
        const payload = { 
            question: savedVal, 
            depth: currentDepth,
            history: currentChatHistory 
        };
        if (savedImage) payload.imageBase64 = savedImage;
        if (savedRag) payload.customContext = savedRag;

        const res = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if(!res.ok) {
            const errBase = await res.text();
            throw new Error(`서버 응답 오류 (상태코드: ${res.status}): ${errBase}`);
        }
        const data = await res.json();

        // Update working history for multi-turn conversations
        currentChatHistory.push({ role: 'user', content: savedVal, image: savedImage });
        // Since the AI now returns {"domain", "chat_reply", ...}, we summarize it back as assistant content
        currentChatHistory.push({ role: 'assistant', content: JSON.stringify(data) });

        // 라이브러리 저장용 데이터 보관
        lastResultPayload = {
            query: savedVal || "이미지/임상 분석",
            summary: data.chat_reply,
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
        };
        if(saveLibraryBtn) saveLibraryBtn.classList.remove('hidden');

        loadingIndicator.classList.add('hidden');
        
        appendAIMessage(data);
        saveHistory(savedVal || "영상/결과지 종합 분석 요청");

    } catch(err) {
        loadingIndicator.classList.add('hidden');
        const errDiv = document.createElement('div');
        errDiv.style.color = "red";
        errDiv.style.padding = "1rem";
        errDiv.innerText = `통신 오류가 발생했습니다: ${err.message}`;
        chatFlowContainer.appendChild(errDiv);
    } finally {
        isThinking = false;
        searchInput.disabled = false;
        searchBtn.disabled = false;
        searchInput.focus();
    }
}

searchBtn.addEventListener('click', handleSearch);

searchInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

searchInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
    }
});

function saveHistory(query) {
    let sessions = JSON.parse(localStorage.getItem('medSessions')) || [];
    let existing = sessions.find(s => s.id === currentSessionId);
    if(existing) {
        existing.history = currentChatHistory;
        if(existing.title === "새로운 대화" && query) {
            existing.title = query;
        }
    } else {
        sessions.unshift({
            id: currentSessionId,
            title: query || "새로운 대화",
            history: currentChatHistory,
            date: new Date().toLocaleString()
        });
    }
    if(sessions.length > 20) sessions = sessions.slice(0,20);
    localStorage.setItem('medSessions', JSON.stringify(sessions));
    renderHistory();
}

function renderHistory() {
    let sessions = JSON.parse(localStorage.getItem('medSessions')) || [];
    const list = document.getElementById('sidebarHistoryList');
    if(sessions.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8;font-size:0.8rem;padding:0.5rem">기록이 없습니다.</p>';
        return;
    }
    list.innerHTML = sessions.slice(0, 15).map(s => `
        <div class="history-item" title="${s.title}" onclick="loadSession('${s.id}')" style="cursor:pointer;">
            <i class="fa-solid fa-message" style="color:var(--text-light); margin-right:6px; font-size:0.8rem"></i> ${s.title}
        </div>
    `).join('');
}

window.loadSession = function(id) {
    closeSidebarOnMobile();
    let sessions = JSON.parse(localStorage.getItem('medSessions')) || [];
    let session = sessions.find(s => s.id === id);
    if(!session) return;

    currentSessionId = session.id;
    currentChatHistory = session.history || [];
    
    viewSearch.classList.add('hidden');
    chatFlowContainer.classList.remove('hidden');
    if (libraryView) libraryView.classList.add('hidden');
    chatFlowContainer.innerHTML = '';
    
    currentChatHistory.forEach(msg => {
        if(msg.role === 'user') {
            appendUserMessage(msg.content, msg.image);
        } else if(msg.role === 'assistant') {
            try {
                let parsed = JSON.parse(msg.content);
                appendAIMessage(parsed);
            } catch(e) {}
        }
    });
    scrollArea.scrollTo({top: scrollArea.scrollHeight, behavior: 'smooth'});
};

if(saveLibraryBtn) {
    saveLibraryBtn.addEventListener('click', () => {
        if(!lastResultPayload) return;
        let lib = JSON.parse(localStorage.getItem('medLibrary')) || [];
        lib.unshift(lastResultPayload);
        localStorage.setItem('medLibrary', JSON.stringify(lib));
        alert("라이브러리에 성공적으로 저장되었습니다!");
    });
}

if(navLibrary) {
    navLibrary.addEventListener('click', (e) => {
        e.preventDefault();
        showLibrary();
    });
}

function renderLibrary() {
    const grid = document.getElementById('libraryGrid');
    if(!grid) return;
    let lib = JSON.parse(localStorage.getItem('medLibrary')) || [];
    if(lib.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-light)">아직 저장된 항목이 없습니다.</p>';
        return;
    }
    grid.innerHTML = lib.map(item => `
        <div class="lib-card">
            <div class="lib-query"><i class="fa-solid fa-quote-left" style="color:#d1d5db;margin-right:8px;"></i>${item.query}</div>
            <div class="lib-date"><i class="fa-regular fa-clock"></i> ${item.date} 저장됨</div>
            <div class="lib-summary">${item.summary}</div>
        </div>
    `).join('');
}

// Mobile Sidebar
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    });
}

function closeSidebarOnMobile() {
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }
}

startNewChat();
renderHistory();
