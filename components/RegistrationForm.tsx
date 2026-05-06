import React, { useState } from 'react';
import { UserCheck, Mail, Phone, Users, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface RegistrationFormProps {
  onCancel: () => void;
  onSubmit: (user: User) => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onCancel, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<User>>({
    groupName: '',
    furigana: '',
    representative: '',
    addressNumber: '',
    phone: '',
    email: '',
    activityContent: '',
    hasMonthlyFee: false,
    memberType: '2', // Default to type 2 (most common)
  });

  const [step, setStep] = useState(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRadioChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      // Simulate ID generation
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData as User,
        isApproved: true // Auto-approve for demo purposes, normally false
      };
      onSubmit(newUser);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="text-emerald-600" />
            利用者登録申請
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            関ヶ谷自治会館 利用者登録票に基づき入力してください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {step === 1 ? (
            <>
              {/* Basic Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">団体名</label>
                  <input
                    type="text"
                    name="groupName"
                    required
                    value={formData.groupName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="例：関ヶ谷卓球クラブ"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">フリガナ</label>
                  <input
                    type="text"
                    name="furigana"
                    required
                    value={formData.furigana}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="例：セキガヤタッキュウクラブ"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">代表者名</label>
                  <input
                    type="text"
                    name="representative"
                    required
                    value={formData.representative}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="例：山田 太郎"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">班－戸番</label>
                  <input
                    type="text"
                    name="addressNumber"
                    value={formData.addressNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="例：3-15"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-200">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Mail size={18} /> 連絡先
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">電話番号</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="例：090-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      placeholder="例：taro@example.com"
                    />
                  </div>
                </div>
                <div className="text-xs text-amber-700 flex items-start gap-1">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>注：sekigayajichikai@gmail.comからのメールを受信できるように設定してください。</span>
                </div>
              </div>

              {/* Activity Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動内容</label>
                  <textarea
                    name="activityContent"
                    required
                    value={formData.activityContent}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="具体的な活動内容を入力してください"
                  />
                </div>
                
                <div>
                  <span className="block text-sm font-bold text-gray-700 mb-2">月謝の有無</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasMonthlyFee"
                        checked={formData.hasMonthlyFee === true}
                        onChange={() => handleRadioChange('hasMonthlyFee', true)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>有</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasMonthlyFee"
                        checked={formData.hasMonthlyFee === false}
                        onChange={() => handleRadioChange('hasMonthlyFee', false)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>無</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Member Composition (Pricing Tier) */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Users size={20} className="text-emerald-600" />
                  構成メンバー・利用区分
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  該当する区分を選択してください。この区分により施設利用料が決定します。
                </p>
                
                <div className="space-y-3">
                  <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.memberType === '1' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="memberType"
                          value="1"
                          checked={formData.memberType === '1'}
                          onChange={handleChange}
                          className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">① 自治会運営</div>
                        <div className="text-sm text-gray-600">役員、自主活動部、委員会等、自治会運営に関するグループ</div>
                        <div className="mt-1 text-sm font-bold text-emerald-700">利用料：無料</div>
                      </div>
                    </div>
                  </label>

                  <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.memberType === '2' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="memberType"
                          value="2"
                          checked={formData.memberType === '2'}
                          onChange={handleChange}
                          className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">② 会員の趣味・親睦</div>
                        <div className="text-sm text-gray-600">自治会員のみの趣味の集まり</div>
                        <div className="mt-1 text-sm font-bold text-emerald-700">利用料：会議室200円 / 他100円</div>
                      </div>
                    </div>
                  </label>

                  <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.memberType === '3' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="memberType"
                          value="3"
                          checked={formData.memberType === '3'}
                          onChange={handleChange}
                          className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">③ 混合団体・教室</div>
                        <div className="text-sm text-gray-600">自治会員以外も含む趣味の集まり、教室など</div>
                        <div className="mt-1 text-sm font-bold text-emerald-700">利用料：会議室500円 / 他200円</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <FileText size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">登録内容の確認</h3>
                <p className="text-gray-500">以下の内容で申請しますか？</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl text-left space-y-4 border border-gray-200">
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                  <span className="text-gray-500">団体名</span>
                  <span className="font-bold">{formData.groupName}</span>
                  
                  <span className="text-gray-500">代表者</span>
                  <span className="font-bold">{formData.representative}</span>
                  
                  <span className="text-gray-500">連絡先</span>
                  <span>{formData.phone}<br/>{formData.email}</span>
                  
                  <span className="text-gray-500">利用区分</span>
                  <span className="font-bold">
                    {formData.memberType === '1' ? '① 自治会運営' : formData.memberType === '2' ? '② 会員の趣味・親睦' : '③ 混合団体・教室'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                ※申請後、管理者による承認およびメールアドレス確認が完了すると、予約機能が利用可能になります。
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={step === 1 ? onCancel : () => setStep(1)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors"
            >
              {step === 1 ? 'キャンセル' : '戻る'}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 transition-all"
            >
              {step === 1 ? '確認画面へ' : '登録を申請する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationForm;