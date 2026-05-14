import { useState } from 'react';
import type { OrgEntry } from '../types';

interface OrgSelectorProps {
  orgsByCategory: Record<string, OrgEntry[]>;
  selectedOrg: string;
  memo: string;
  onSelect: (orgName: string, tier: string, equipment: string[]) => void;
  onMemoChange: (memo: string) => void;
}

const OrgSelector: React.FC<OrgSelectorProps> = ({
  orgsByCategory, selectedOrg, memo, onSelect, onMemoChange,
}) => {
  const categories = Object.keys(orgsByCategory);
  const [activeCategory, setActiveCategory] = useState(categories[0] || '');

  const currentOrgs = orgsByCategory[activeCategory] || [];
  const selectedOrgData = currentOrgs.find(o => o.name === selectedOrg);
  const presets = selectedOrgData?.presets || [];

  const handlePresetClick = (preset: string) => {
    const current = memo.trim();
    if (current && !current.endsWith('・')) {
      onMemoChange(current + '・' + preset);
    } else {
      onMemoChange(current + preset);
    }
  };

  return (
    <div className="space-y-3">
      {/* カテゴリタブ */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">団体カテゴリ</label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 団体ボタン */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">団体名</label>
        <div className="flex flex-wrap gap-2">
          {currentOrgs.map(org => (
            <button
              key={org.name}
              type="button"
              onClick={() => onSelect(org.name, org.tier, org.equipment)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                selectedOrg === org.name
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
              }`}
            >
              {org.name}
            </button>
          ))}
          {currentOrgs.length === 0 && (
            <span className="text-sm text-gray-400">このカテゴリに団体がありません</span>
          )}
        </div>
      </div>

      {/* 活動プリセット */}
      {presets.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">活動内容（クリックでメモに追加）</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="px-2.5 py-1 rounded-full text-xs border border-gray-300 bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:border-emerald-400 transition-all"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* メモ入力 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">活動内容・メモ</label>
        <input
          type="text"
          value={memo}
          onChange={e => onMemoChange(e.target.value)}
          placeholder="例：会議、スマホ講習会"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
        />
      </div>
    </div>
  );
};

export default OrgSelector;
