import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User as UserIcon, FileText, CheckCircle, Info, Calculator, X, MonitorPlay } from 'lucide-react';
import { ROOMS, USAGE_CATEGORIES, EQUIPMENT_ITEMS, getPrice } from '../constants';
import { RoomType, User } from '../types';

interface BookingFormProps {
  selectedDate: Date;
  initialRoom: RoomType;
  initialStartTime: string;
  initialEndTime: string;
  currentUser: User | null; // Added currentUser prop
  onCancel: () => void;
  onSubmit: (formData: any) => void;
}

const BookingForm: React.FC<BookingFormProps> = ({ 
  selectedDate, 
  initialRoom,
  initialStartTime,
  initialEndTime,
  currentUser,
  onCancel, 
  onSubmit 
}) => {
  const [step, setStep] = useState(1);

  // Determine initial category based on user memberType
  const getInitialCategory = (user: User | null) => {
    if (!user) return USAGE_CATEGORIES[0].id;
    if (user.memberType === '1') return 'official';
    if (user.memberType === '2') return 'member_hobby';
    if (user.memberType === '3') return 'mixed_class';
    return USAGE_CATEGORIES[0].id;
  };

  const [formData, setFormData] = useState({
    name: currentUser ? currentUser.representative : '',
    phone: currentUser ? currentUser.phone : '',
    room: initialRoom,
    startTime: initialStartTime,
    endTime: initialEndTime,
    category: getInitialCategory(currentUser),
    purpose: currentUser ? currentUser.activityContent : '',
    equipment: [] as string[],
    agreed: false
  });

  const [useEquipment, setUseEquipment] = useState(false);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    // If toggle is off, clear equipment
    if (!useEquipment && formData.equipment.length > 0) {
      setFormData(prev => ({ ...prev, equipment: [] }));
    }
  }, [useEquipment]);

  useEffect(() => {
    const newPrice = getPrice(formData.category, formData.room, formData.equipment);
    setPrice(newPrice);
  }, [formData.category, formData.room, formData.equipment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEquipmentChange = (itemId: string, checked: boolean) => {
    setFormData(prev => {
      const newEquipment = checked 
        ? [...prev.equipment, itemId]
        : prev.equipment.filter(id => id !== itemId);
      return { ...prev, equipment: newEquipment };
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, agreed: e.target.checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      onSubmit({ ...formData, price });
    }
  };

  const selectedRoomData = ROOMS.find(r => r.id === formData.room);
  const selectedCategoryData = USAGE_CATEGORIES.find(c => c.id === formData.category);
  const selectedEquipmentNames = EQUIPMENT_ITEMS.filter(item => formData.equipment.includes(item.id)).map(item => item.name);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-5 border-b border-gray-100 bg-white sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-emerald-600" />
            予約詳細入力
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
             <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {step === 1 ? (
            <>
              {/* Login Info Banner */}
              {currentUser && (
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2 text-sm text-emerald-800">
                  <UserIcon size={16} />
                  <span>
                    <strong>{currentUser.groupName}</strong> ({currentUser.representative}様) としてログイン中
                  </span>
                </div>
              )}

              {/* Summary of Selection */}
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

              {/* Usage Category */}
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
                        disabled={!!currentUser && cat.priceType !== 'stay'} // Lock category if logged in (unless stay)
                        className="text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
                      />
                      <span className="ml-2 font-medium text-gray-800 text-sm">{cat.name}</span>
                      <span className="ml-auto font-bold text-gray-600 text-sm">
                        ¥{getPrice(cat.id, formData.room).toLocaleString()}
                      </span>
                    </label>
                  ))}
                  {currentUser && (
                     <p className="text-xs text-gray-500 mt-1">※登録情報に基づき、自動で区分が選択されています。</p>
                  )}
                </div>
              </div>

              {/* Equipment Rental Toggle */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                      <MonitorPlay size={20} className="text-gray-600" />
                      <label htmlFor="useEquipment" className="font-bold text-gray-700 cursor-pointer select-none">
                         オプション備品・機器
                      </label>
                   </div>
                   
                   {/* Toggle Switch */}
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        id="useEquipment" 
                        className="sr-only peer" 
                        checked={useEquipment}
                        onChange={(e) => setUseEquipment(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span className="ml-2 text-sm font-medium text-gray-600">{useEquipment ? '利用する' : '利用しない'}</span>
                   </label>
                </div>
                
                {useEquipment && (
                   <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 animate-fade-in">
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

              {/* Applicant Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">代表者氏名</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="例：山田 太郎"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">電話番号</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="例：090-1234-5678"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">具体的な利用内容</label>
                  <input
                    type="text"
                    name="purpose"
                    required
                    placeholder="例：卓球の練習"
                    value={formData.purpose}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-gray-800 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
                 <div className="flex items-center gap-2">
                    <Calculator className="text-emerald-400" />
                    <span className="font-medium">概算利用料金</span>
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
            <div className="space-y-6 text-center py-2">
               <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce-short">
                     <CheckCircle size={32} />
                  </div>
               </div>
               <h3 className="text-lg font-bold">この内容で予約をリクエストしますか？</h3>
               
               <div className="bg-gray-50 p-5 rounded-xl text-left space-y-3 text-sm border border-gray-100">
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                     <span className="text-gray-500">日時</span>
                     <span className="font-bold">{selectedDate.toLocaleDateString()} {formData.startTime}~{formData.endTime}</span>
                     
                     <span className="text-gray-500">部屋</span>
                     <span className="font-bold">{selectedRoomData?.name}</span>
                     
                     <span className="text-gray-500">利用区分</span>
                     <span className="font-medium">{selectedCategoryData?.name}</span>

                     {selectedEquipmentNames.length > 0 && (
                        <>
                           <span className="text-gray-500">備品</span>
                           <span className="font-medium text-gray-700">
                              {selectedEquipmentNames.join('、')}
                           </span>
                        </>
                     )}
                     
                     <span className="text-gray-500">料金</span>
                     <span className="font-bold text-emerald-600">¥{price.toLocaleString()}</span>
                     
                     <span className="text-gray-500">氏名</span>
                     <span className="font-medium">{formData.name}</span>
                     
                     <span className="text-gray-500">内容</span>
                     <span className="font-medium">{formData.purpose}</span>
                  </div>
               </div>

               <div className="flex items-center justify-center gap-2 mt-4 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <input 
                    type="checkbox" 
                    id="agreed" 
                    checked={formData.agreed} 
                    onChange={handleCheckboxChange}
                    className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" 
                  />
                  <label htmlFor="agreed" className="text-sm text-gray-700 font-medium select-none cursor-pointer">
                     利用規約に同意し、近隣へ配慮します
                  </label>
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
              disabled={step === 2 && !formData.agreed}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
            >
              {step === 1 ? '確認へ進む' : '予約を確定する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingForm;