"use client";
import { useState } from 'react';

export default function BookmarkBtn({ messageId }: { messageId: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [tagInput, setTagInput] = useState(false);
  const [tagText, setTagText] = useState('');

  const toggleBookmark = async () => {
    // For prototype, using a dummy userId just for demonstration
    const res = await fetch('/api/bookmarks', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, userId: 'dummy-user-123' })
    });
    if (res.ok) {
      const data = await res.json();
      setBookmarked(data.bookmarked);
    }
  };

  const addTag = async () => {
    if (!tagText.trim()) return setTagInput(false);
    await fetch('/api/tags', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, tag: tagText.trim() })
    });
    setTagInput(false);
    setTagText('');
  };

  return (
    <div className="flex gap-2 relative">
      <button onClick={toggleBookmark} className={`text-xs flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-100 ${bookmarked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
        🔖 {bookmarked ? '북마크됨' : '북마크'}
      </button>
      
      {!tagInput ? (
        <button onClick={() => setTagInput(true)} className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
          🏷️ 태그 추가
        </button>
      ) : (
        <div className="flex text-xs bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
          <input 
            type="text" 
            autoFocus
            className="px-2 py-1 outline-none w-24" 
            placeholder="태그..." 
            value={tagText} 
            onChange={(e) => setTagText(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && addTag()} 
          />
          <button onClick={addTag} className="bg-gray-100 px-2 py-1 border-l text-gray-600 hover:bg-blue-100 hover:text-blue-700">저장</button>
        </div>
      )}
    </div>
  );
}
