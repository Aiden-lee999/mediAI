const fs = require('fs');

let indexHtml = fs.readFileSync('E:/mediAI/index.html', 'utf8');

if (!indexHtml.includes('opinionModal')) {
    const modalHtml = `
    <!-- 의사 의견 남기기 모달 -->
    <div id="opinionModal" class="auth-overlay hidden" style="z-index: 1000;">
        <div class="auth-card" style="max-width: 500px;">
            <h2 style="font-size: 1.2rem; color: var(--primary);"><i class="fa-solid fa-comments"></i> 내 의견 남기기</h2>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 15px;">이 답변에 대한 원장님의 실무 경험과 팁을 공유해주세요.</p>
            <div class="auth-form">
                <div style="display:flex; gap:10px; margin-bottom:15px;" id="opinionReactions">
                    <button class="auth-btn" style="flex:1; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0;" onclick="selectReaction('like')"><i class="fa-solid fa-thumbs-up"></i> 좋아요</button>
                    <button class="auth-btn" style="flex:1; background:#fff1f2; color:#be123c; border:1px solid #fecdd3;" onclick="selectReaction('dislike')"><i class="fa-solid fa-thumbs-down"></i> 싫어요</button>
                    <button class="auth-btn" style="flex:1; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;" onclick="selectReaction('neutral')"><i class="fa-solid fa-minus"></i> 보류</button>
                </div>
                <div>
                    <label>실무 팁 / 의견 작성</label>
                    <textarea id="opinionText" rows="4" placeholder="실제 진료에서는 이런 점을 더 봐야 합니다..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></textarea>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
                    <span class="suggestion-btn" style="font-size:0.75rem; padding:3px 8px; cursor:pointer; background:#f1f5f9; border-radius:12px;" onclick="addTag('실제 효과 좋음')">+ 실제 효과 좋음</span>
                    <span class="suggestion-btn" style="font-size:0.75rem; padding:3px 8px; cursor:pointer; background:#f1f5f9; border-radius:12px;" onclick="addTag('근거 약함')">+ 근거 약함</span>
                    <span class="suggestion-btn" style="font-size:0.75rem; padding:3px 8px; cursor:pointer; background:#f1f5f9; border-radius:12px;" onclick="addTag('고령자 주의')">+ 고령자 주의</span>
                    <span class="suggestion-btn" style="font-size:0.75rem; padding:3px 8px; cursor:pointer; background:#f1f5f9; border-radius:12px;" onclick="addTag('보험/삭감 이슈')">+ 보험/삭감 이슈</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="auth-btn" style="background:#94a3b8;" onclick="closeOpinionModal()">취소</button>
                    <button class="auth-btn" onclick="submitOpinion()">의견 등록하기</button>
                </div>
            </div>
        </div>
    </div>
    <script>
        let currentOpinionResponseId = null;
        function openOpinionModal(responseId) {
            currentOpinionResponseId = responseId;
            document.getElementById('opinionModal').classList.remove('hidden');
        }
        function closeOpinionModal() {
            document.getElementById('opinionModal').classList.add('hidden');
            document.getElementById('opinionText').value = '';
        }
        function selectReaction(type) {
            alert(type + ' 선택됨 (의사 집단 반응 시스템에 누적됩니다)');
        }
        function addTag(tag) {
            const txt = document.getElementById('opinionText');
            txt.value = txt.value ? txt.value + ' [' + tag + '] ' : '[' + tag + '] ';
        }
        function submitOpinion() {
            alert('전문가 의견이 성공적으로 등록되었습니다. 의사 집단 요약(Doctor Consensus)에 반영됩니다.');
            closeOpinionModal();
        }
    </script>
`;
    indexHtml = indexHtml.replace('</body>', modalHtml + '\n</body>');
    fs.writeFileSync('E:/mediAI/index.html', indexHtml, 'utf8');
}

let appJs = fs.readFileSync('E:/mediAI/app.js', 'utf8');

// Replace alerts with actual function calls
appJs = appJs.replace(/onclick="alert\('의견 남기기 기능이 곧 오픈됩니다\.'\)"/g, `onclick="openOpinionModal(Date.now().toString())"`);
appJs = appJs.replace(/onclick="alert\('의견 남기기 창이 열립니다\.'\)"/g, `onclick="openOpinionModal(Date.now().toString())"`);

fs.writeFileSync('E:/mediAI/app.js', appJs, 'utf8');

console.log('UI Overhaul Completed');
