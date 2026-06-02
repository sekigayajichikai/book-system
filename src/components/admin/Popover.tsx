import { useEffect, useRef, useCallback } from 'react';

interface PopoverProps {
  anchorRect: { top: number; left: number; width: number; height: number };
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/**
 * Google Calendar風ポップオーバー。
 * anchorRect（クリック要素の位置）付近にfixed表示する。
 * ビューポートをはみ出す場合は自動で位置調整。
 * 内容が画面に収まらない場合はスクロール可能。
 */
export default function Popover({ anchorRect, onClose, children, width = 380 }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const popH = el.scrollHeight;
    const popW = width;

    // 水平: アンカーの右端を起点、はみ出す場合は左にずらす
    let left = anchorRect.left + anchorRect.width + 8;
    if (left + popW > vw - 16) {
      left = anchorRect.left - popW - 8;
    }
    if (left < 16) left = 16;

    // 垂直: アンカーのtopを起点、下にはみ出す場合は上にずらす
    let top = anchorRect.top;
    if (top + popH > vh - 16) {
      top = vh - popH - 16;
    }
    if (top < 16) top = 16;

    // maxHeightを設定してスクロール可能に
    const maxH = vh - 32;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(16, top)}px`;
    el.style.maxHeight = `${maxH}px`;
  }, [anchorRect, width]);

  useEffect(() => {
    reposition();
  }, [reposition]);

  // 子要素の変化（編集フォーム展開等）で再計算
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => reposition());
    observer.observe(el);
    return () => observer.disconnect();
  }, [reposition]);

  return (
    <>
      {/* 背景オーバーレイ（透明） */}
      <div className="fixed inset-0 z-50" onClick={onClose} />
      {/* ポップオーバー本体 */}
      <div
        ref={ref}
        className="fixed z-50 bg-gray-50 rounded-2xl shadow-2xl border border-gray-200 overflow-y-auto"
        style={{ width: `${width}px` }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
