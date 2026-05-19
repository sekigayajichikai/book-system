import { MapPin, Clock, CalendarDays } from 'lucide-react';

interface Banner {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  event_location?: string;
  style: string;
  image_url?: string;
}

const STYLES: Record<string, { bg: string; border: string; accent: string; text: string; badge: string }> = {
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-300', accent: 'text-emerald-700', text: 'text-emerald-600', badge: 'bg-emerald-600' },
  blue:   { bg: 'bg-blue-50', border: 'border-blue-300', accent: 'text-blue-700', text: 'text-blue-600', badge: 'bg-blue-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-300', accent: 'text-orange-700', text: 'text-orange-600', badge: 'bg-orange-500' },
  pink:   { bg: 'bg-pink-50', border: 'border-pink-300', accent: 'text-pink-700', text: 'text-pink-600', badge: 'bg-pink-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-300', accent: 'text-purple-700', text: 'text-purple-600', badge: 'bg-purple-600' },
};

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}

interface MobileBannerProps {
  banner: Banner;
}

export default function MobileBanner({ banner }: MobileBannerProps) {
  const s = STYLES[banner.style] || STYLES.green;

  // 画像バナー
  if (banner.image_url) {
    return (
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <img src={banner.image_url} alt={banner.title} className="w-full" />
      </div>
    );
  }

  // HTMLテンプレートバナー
  return (
    <div className={`rounded-xl border-2 ${s.border} ${s.bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className={`${s.badge} text-white p-2 rounded-lg shrink-0`}>
          <CalendarDays size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-lg font-bold ${s.accent} leading-tight`}>{banner.title}</div>
          {banner.description && (
            <div className={`text-sm ${s.text} mt-1`}>{banner.description}</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            <span className={`flex items-center gap-1 text-sm ${s.text}`}>
              <CalendarDays size={14} /> {formatEventDate(banner.event_date)}
            </span>
            {banner.event_time && (
              <span className={`flex items-center gap-1 text-sm ${s.text}`}>
                <Clock size={14} /> {banner.event_time}
              </span>
            )}
            {banner.event_location && (
              <span className={`flex items-center gap-1 text-sm ${s.text}`}>
                <MapPin size={14} /> {banner.event_location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
