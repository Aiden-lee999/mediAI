'use client';

import { useEffect, useRef, useState } from 'react';

export type AddressSuggestion = {
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  latitude: number;
  longitude: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
};

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
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
    if (q.length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/maps/search-address?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: 'no-store' });
        const data = await res.json();
        setItems(data?.addresses || []);
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
        onFocus={() => value.trim().length >= 2 && setOpen(true)}
        className={className || 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}
        placeholder={placeholder || '도로명/지번을 검색하세요'}
      />
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">주소 검색 중...</div>}
          {items.map((item, index) => (
            <button
              key={`${item.address}_${index}`}
              type="button"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-50"
            >
              <div className="text-sm font-bold text-slate-900">{item.roadAddress || item.address}</div>
              {item.jibunAddress && <div className="mt-0.5 text-xs text-slate-500">지번: {item.jibunAddress}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
