'use client';

import { useState, useEffect } from 'react';

type Review = {
  id: string;
  version: string;
  reviewNotes: string | null;
  reviewer: { name: string } | null;
  status: string;
  message: { content: string } | null;
};

export default function ReviewManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      console.error('Failed to fetch reviews', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch('/api/reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchReviews();
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  if (loading) return <div>데이터를 불러오는 중입니다...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-sm">
            <th className="pb-3 font-medium">답변 버전</th>
            <th className="pb-3 font-medium">원본 메시지 내용</th>
            <th className="pb-3 font-medium">검수자</th>
            <th className="pb-3 font-medium">상태</th>
            <th className="pb-3 font-medium">액션</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {reviews.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-gray-500">
                현재 검수 대기 중인 항목이 없습니다.
              </td>
            </tr>
          ) : (
            reviews.map((review) => (
              <tr key={review.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-4 font-mono text-gray-500">{review.version}</td>
                <td className="py-4 font-semibold max-w-xs truncate">
                  {review.message?.content || review.reviewNotes || "내용 없음"}
                </td>
                <td className="py-4">{review.reviewer?.name || "미지정"}</td>
                <td className="py-4">
                  {review.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">검수 대기</span>}
                  {review.status === 'APPROVED' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">승인 완료</span>}
                  {review.status === 'REJECTED' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">반려됨</span>}
                </td>
                <td className="py-4 space-x-2">
                  {review.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleUpdateStatus(review.id, 'APPROVED')} className="text-green-600 hover:underline font-medium">승인</button>
                      <button onClick={() => handleUpdateStatus(review.id, 'REJECTED')} className="text-red-600 hover:underline font-medium">반려</button>
                    </>
                  )}
                  {review.status !== 'PENDING' && (
                    <button className="text-gray-400 hover:text-gray-600 font-medium cursor-not-allowed">처리 완료</button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
