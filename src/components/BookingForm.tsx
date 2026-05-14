import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, FileText, CheckCircle, Calculator, X, MonitorPlay } from 'lucide-react';
import { ROOMS, USAGE_CATEGORIES, EQUIPMENT_ITEMS, TIME_SLOTS, getPrice } from '../constants';
import { RoomType, BookingRequest, OrgEntry } from '../types';
import OrgSelector from './OrgSelector';

interface BookingFormProps {
  selectedDate: Date;
  initialRoom: RoomType;
  initialStartTime: string;
  initialEndTime: string;
  onCancel: () => void;
  onSubmit: (data: BookingRequest) => void;
  submitting?: boolean;
  orgsByCategory?: Record<string, OrgEntry[]>;
}

const BookingForm: React.FC<BookingFormProps> = ({
  selectedDate, initialRoom, initialStartTime, initialEndTime,
  onCancel, onSubmit, submitting, orgsByCategory,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    orgName: '',
    memo: '',
    room: initialRoom,
    startTime: initialStartTime,
    endTime: initialEndTime,
    category: USAGE_CATEGORIES[0].id,
    equipment: [] as string[],
  });
  const [useEquipment, setUseEquipment] = useState(false);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (!useEquipment && formData.equipment.length > 0) {
      setFormData(prev => ({ ...prev, equipment: [] }));
    }
  }, [useEquipment]);

  useEffect(() => {
    setPrice(getPrice(formData.category, formData.room, formData.equipment));
  }, [formData.category, formData.room, formData.equipment]);

  const handleOrgSelect = (orgName: string, tier: string, defaultEquipment: string[]) => {
    const matchedCategory = USAGE_CATEGORIES.find(c => c.tier === tier);
    setFormData(prev => ({
      ...prev,
      orgName,
      category: matchedCategory?.id || prev.category,
      equipment: defaultEquipment.length > 0 ? defaultEquipment : prev.equipment,
    }));
    if (defaultEquipment.length > 0) {
      setUseEquipment(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEquipmentChange = (itemId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      equipment: checked
        ? [...prev.equipment, itemId]
        : prev.equipment.filter(id => id !== itemId),
    }));
  };

  // 時間帯からGASのスロットキーを取得
  const getSlotKey = (startTime: string): string => {
    const slot = TIME_SLOTS.find(s => s.startTime === startTime);
    return slot?.gasKey || '午前';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.orgName) {
        alert('団体名を選択してください');
        return;
      }
      setStep(2);
    } else {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const title = formData.memo
        ? `${formData.orgName}「${formData.memo}」`
        : formData.orgName;

      onSubmit({
        date: dateStr,
        slot: getSlotKey(formData.startTime),
        room: formData.room,
        title,
        org: formData.orgName,
        category: formData.category,
        equipment: formData.equipment,
        price,
      });
    }
  };

  const selectedRoomData = ROOMS.find(r => r.id === formData.room);
  const selectedCategoryData = USAGE_CATEGORIES.find(c => c.id === formData.category);
  const selectedEquipmentNames = EQUIPMENT_ITEMS.filter(item => formData.equipment.includes(item.id)).map(item => item.name);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-5 border-b border-gray-100 bg-white sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-emerald-600" />
            予約入力
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {step === 1 ? (
            <>
              {/* 日時・部屋サマリ */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center gap-2 text-blue-800 font-bold">
                  <CalendarIcon size={18} />
                  <span>{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日</span>
                  <span className="mx-1 text-blue-300">|</span>
                  <Clock size={18} />
                  <span>{formData.startTime} - {formData.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <span className="px-2 py-0.5 bg-blue-200 rounded text-xs font-bold">部屋</span>
                  <span>{selectedRoomData?.name}</span>
                </div>
              </div>

              {/* 団体マスタ選択 */}
              {orgsByCategory && Object.keys(orgsByCategory).length > 0 ? (
                <OrgSelector
                  orgsByCategory={orgsByCategory}
                  selectedOrg={formData.orgName}
                  memo={formData.memo}
                  onSelect={handleOrgSelect}
                  onMemoChange={(memo) => setFormData(prev => ({ ...prev, memo }))}
                />
              ) : (
                /* マスタがない場合はフリー入力 */
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">団体名・イベント名</label>
                  <input
                    type="text"
                    name="orgName"
                    required
                    placeholder="例：DX委員会"
                    value={formData.orgName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-base"
                  />
                </div>
              )}

              {/* 利用区分 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">利用区分（料金プラン）</label>
                <div className="space-y-2">
                  {USAGE_CATEGORIES.map(cat => (
                    <label
                      key={cat.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                        formData.category === cat.id
                          ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={cat.id}
                        checked={formData.category === cat.id}
                        onChange={handleChange}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="ml-2 font-medium text-gray-800 text-sm">{cat.name}</span>
                      <span className="ml-auto font-bold text-gray-600 text-sm">
                        ¥{getPrice(cat.id, formData.room).toLocaleString()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 用具 */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MonitorPlay size={20} className="text-gray-600" />
                    <label htmlFor="useEquipment" className="font-bold text-gray-700 cursor-pointer select-none">
                      オプション備品・機器
                    </label>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="useEquipment"
                      className="sr-only peer"
                      checked={useEquipment}
                      onChange={(e) => setUseEquipment(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                    <span className="ml-2 text-sm font-medium text-gray-600">{useEquipment ? '利用する' : '利用しない'}</span>
                  </label>
                </div>

                {useEquipment && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                    <p className="text-xs text-gray-500 mb-2">※電子機器利用料：1点につき300円</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EQUIPMENT_ITEMS.map(item => (
                        <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={formData.equipment.includes(item.id)}
                            onChange={(e) => handleEquipmentChange(item.id, e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-gray-700">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 料金 */}
              <div className="bg-gray-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <Calculator className="text-emerald-400" />
                  <span className="font-medium">利用料金</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-400">
                    ¥{price.toLocaleString()}
                  </div>
                  {formData.equipment.length > 0 && (
                    <div className="text-[10px] text-gray-400">
                      (内 備品: ¥{(formData.equipment.length * 300).toLocaleString()})
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Step 2: 確認画面 */
            <div className="space-y-6 text-center py-2">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle size={32} />
                </div>
              </div>
              <h3 className="text-lg font-bold">この内容で保存しますか？</h3>

              <div className="bg-gray-50 p-5 rounded-xl text-left space-y-3 text-sm border border-gray-100">
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <span className="text-gray-500">日時</span>
                  <span className="font-bold">{selectedDate.getFullYear()}/{selectedDate.getMonth() + 1}/{selectedDate.getDate()} {formData.startTime}〜{formData.endTime}</span>
                  <span className="text-gray-500">部屋</span>
                  <span className="font-bold">{selectedRoomData?.name}</span>
                  <span className="text-gray-500">団体名</span>
                  <span className="font-bold">{formData.orgName}</span>
                  {formData.memo && (
                    <>
                      <span className="text-gray-500">活動内容</span>
                      <span className="font-medium text-gray-700">{formData.memo}</span>
                    </>
                  )}
                  <span className="text-gray-500">利用区分</span>
                  <span className="font-medium">{selectedCategoryData?.name}</span>
                  {selectedEquipmentNames.length > 0 && (
                    <>
                      <span className="text-gray-500">備品</span>
                      <span className="font-medium text-gray-700">{selectedEquipmentNames.join('、')}</span>
                    </>
                  )}
                  <span className="text-gray-500">料金</span>
                  <span className="font-bold text-emerald-600">¥{price.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={step === 1 ? onCancel : () => setStep(1)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
            >
              {step === 1 ? 'キャンセル' : '戻る'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
            >
              {submitting ? '保存中...' : step === 1 ? '確認へ進む' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;
