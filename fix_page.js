const fs = require('fs');

let code = fs.readFileSync('src/app/dashboard/page.tsx', 'utf8');

// 1. Add imports at the beginning
if (!code.includes('import ReactMarkdown')) {
    code = code.replace("import { useState, useRef, useEffect, useMemo } from 'react';", "import { useState, useRef, useEffect, useMemo } from 'react';\nimport ReactMarkdown from 'react-markdown';\nimport remarkGfm from 'remark-gfm';");
}

// 2. Replace handleSendMessage body fetch & json part
const handleMsgSearch = `        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: targetText, history: newHistory, imageBase64: userMsg.image })
        });
        const data = await res.json();
        
        if (!res.ok || data.error) {
           throw new Error(data.error || 'Server error occurred');
        }
  
        const assistantMsg = { role: 'assistant', parsedData: data };
        const finalizedHistory = [...newHistory, assistantMsg];
        setMessages(finalizedHistory);
  
        // 세션 저장
        currentQueryPayload.summary = data.chat_reply;`;

const handleMsgReplace = `        const res = await fetch('/api/ask', {
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
        
        setMessages([...newHistory, assistantMsg]);
        
        if (reader) {
           while (true) {
             const { done, value } = await reader.read();
             if (done) break;
             text += decoder.decode(value, { stream: true });
             assistantMsg.parsedData.chat_reply = text;
             
             setMessages([...newHistory, { ...assistantMsg }]);
           }
        }
  
        const finalizedHistory = [...newHistory, assistantMsg];
        setMessages(finalizedHistory);
  
        // 세션 저장
        currentQueryPayload.summary = text.substring(0, 30);`;

code = code.replace(handleMsgSearch, handleMsgReplace);

// 3. Replace Translate fetch & json part
const transSearch = `        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: \`다음 내용을 \${transLang}로 의학적 뉘앙스를 살려서 환자/보호자가 이해하기 쉽게 번역해줘:\\n"\${transInput}"\` })
        });
        const data = await res.json();
        
        let transText = data.chat_reply;
        let noteText = '';
        if (data.blocks) {
           const tBlock = data.blocks.find((b:any) => b.block_type === 'translation');
           if (tBlock) {
               transText = tBlock.body;
               noteText = tBlock.meta_json?.clinical_note || '';
           }
        }`;

const transReplace = `        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: \`다음 내용을 \${transLang}로 의학적 뉘앙스를 살려서 환자/보호자가 이해하기 쉽게 번역해줘:\\n"\${transInput}"\` })
        });
        
        // Since we changed it to stream text
        const transText = await res.text();
        let noteText = '';`;

code = code.replace(transSearch, transReplace);

// 4. Update the chat_reply renderer to use ReactMarkdown
const renderSearch = `{msg.parsedData?.chat_reply && (
                                  <div className="text-sm leading-relaxed whitespace-pre-wrap mb-4 font-medium text-slate-800">
                                    {msg.parsedData.chat_reply}
                                  </div>
                                )}`;

const renderReplace = `{msg.parsedData?.chat_reply && (
                                  <div className="text-sm leading-relaxed mb-4 font-medium text-slate-800 prose prose-sm max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {msg.parsedData.chat_reply}
                                    </ReactMarkdown>
                                  </div>
                                )}`;

code = code.replace(renderSearch, renderReplace);

fs.writeFileSync('src/app/dashboard/page.tsx', code);
console.log('Fixed page.tsx');