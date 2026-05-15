'use client';

import { useEffect, useRef, useState } from 'react';

export type HospitalSuggestion = {
  id: string;
  encryptedCode: string;
  name: string;
  typeName?: string | null;
  sidoName?: string | null;
  sigunguName?: string | null;
  address?: string | null;
  phone?: string | null;
  totalDoctors?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (hospital: HospitalSuggestion) => void;
  placeholder?: string;
  className?: string;
};

export default function HospitalAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [items, setItems] = useState<HospitalSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hospitals/search?q=${encodeURIComponent(q)}&limit=12`, { signal: controller.signal, cache: 'no-store' });
        const data = await res.json();
        setItems(data?.hospitals || []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => value.trim() && setOpen(true)}
        className={className || 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}
        placeholder={placeholder || '병의원명을 입력하면 자동검색됩니다'}
      />
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">병의원 검색 중...</div>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-50"
            >
              <div className="text-sm font-bold text-slate-900">{item.name}</div>
              <div className="mt-0.5 text-xs text-slate-500">{item.typeName || '의료기관'} · {item.sidoName || ''} {item.sigunguName || ''}</div>
              <div className="mt-0.5 truncate text-xs text-slate-400">{item.address || '주소 정보 없음'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
