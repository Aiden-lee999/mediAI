const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

const s = code.indexOf('const handleSendMessage = async (textToSearch: string) => {');
const e = code.indexOf('const handleTranslate = async () => {');

const replacement = `const handleSendMessage = async (textToSearch: string) => {
    const targetText = textToSearch.trim();
    if (!targetText && !attachmentBase64) return;
    
    const userMsg = { role: 'user', content: targetText, image: attachmentBase64 };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    
    const currentQueryPayload = {
      query: targetText || "이미지/임상 분석",
      summary: "",
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    setChatInput('');
    setAttachmentBase64(null);
    setIsThinking(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: targetText, history: newHistory, imageBase64: userMsg.image })
      });
      
      if (!res.ok) {
         throw new Error('Server error occurred');
      }
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = '';
      const assistantMsg = { role: 'assistant', parsedData: { chat_reply: '' } };
      
      setMessages((prev) => [...prev, assistantMsg]);
      
      if (reader) {
         while (true) {
           const { done, value } = await reader.read();
           if (done) break;
           text += decoder.decode(value, { stream: true });
           assistantMsg.parsedData.chat_reply = text;
           setMessages((prev) => {
             const updated = [...prev];
             updated[updated.length - 1] = { ...assistantMsg };
             return updated;
           });
         }
      }

      const finalizedHistory = [...newHistory, assistantMsg];
      
      // 세션 저장
      currentQueryPayload.summary = text.substring(0, 30);
      const existingIdx = sessions.findIndex(s => s.id === currentSessionId);
      const newSessions = [...sessions];
      if (existingIdx >= 0) {
         newSessions[existingIdx].history = finalizedHistory;
         if (newSessions[existingIdx].title === "새로운 대화" && targetText) {
             newSessions[existingIdx].title = targetText;
         }
      } else {
         newSessions.unshift({ id: currentSessionId, title: targetText || "새로운 대화", history: finalizedHistory, date: new Date().toLocaleDateString() });
      }
      setSessions(newSessions);
      localStorage.setItem('medSessions', JSON.stringify(newSessions));
      
      (window as any).lastResultPayload = currentQueryPayload;

    } catch (error) {
      setMessages([...newHistory, { role: 'assistant', error: '서버 통신 오류가 발생했습니다.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  `;

code = code.substring(0, s) + replacement + code.substring(e);

// Update render behavior properly
const renderTarget = `{msg.parsedData?.chat_reply && (
                                  <div className="text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium text-slate-800">
                                    {msg.parsedData.chat_reply}
                                  </div>
                                )}`;
const renderReplacement = `{msg.parsedData?.chat_reply && (
                                  <div className="text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium text-slate-800 break-words prose prose-sm max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {msg.parsedData.chat_reply}
                                    </ReactMarkdown>
                                  </div>
                                )}`;

if (code.includes(renderTarget)) {
    code = code.replace(renderTarget, renderReplacement);
} else {
    // try fallback 
    code = code.replace(/\{msg.parsedData\?\.chat_reply && \(\s*<div[^>]*>\s*\{msg.parsedData\.chat_reply\}\s*<\/div>\s*\)\}/m, renderReplacement);
}

// Add import if missing
if (!code.includes('import ReactMarkdown')) {
    code = code.replace("import { useState, useRef, useEffect, useMemo } from 'react';", "import { useState, useRef, useEffect, useMemo } from 'react';\nimport ReactMarkdown from 'react-markdown';\nimport remarkGfm from 'remark-gfm';");
}

fs.writeFileSync('src/app/dashboard/page.tsx', code);
console.log('Successfully injected streaming!');