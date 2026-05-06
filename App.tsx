import React, { useState } from 'react';
import { Menu, MapPin, Phone, Calendar as CalendarIcon, Info, Users, LogIn, User as UserIcon, LogOut, X, CheckCircle } from 'lucide-react';
import Calendar from './components/Calendar';
import DailyScheduleGrid from './components/DailyScheduleGrid';
import BookingForm from './components/BookingForm';
import Assistant from './components/Assistant';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import { Booking, BookingStatus, RoomType, User } from './types';
import { TIME_SLOTS, USAGE_CATEGORIES } from './constants';

// Mock data initialization
const INITIAL_BOOKINGS: Booking[] = [
  {
    id: '1',
    date: new Date().toISOString().split('T')[0], // Today
    startTime: '09:00',
    endTime: '12:00',
    room: RoomType.ROOM_1F,
    applicantName: '鈴木',
    purpose: '卓球サークル',
    category: 'member_hobby',
    equipment: [],
    price: 200,
    status: BookingStatus.CONFIRMED
  },
  {
    id: '2',
    date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0], // 2 days later
    startTime: '13:00',
    endTime: '16:00',
    room: RoomType.JAPANESE_1,
    applicantName: '佐藤',
    purpose: '着付け教室',
    category: 'mixed_class',
    equipment: [],
    price: 200,
    status: BookingStatus.CONFIRMED
  }
];

// Mock Users Database
const MOCK_USERS: User[] = [
  {
    id: 'user1',
    groupName: '関ヶ谷卓球クラブ',
    representative: '山田 太郎',
    furigana: 'ヤマダ タロウ',
    addressNumber: '1-23',
    phone: '090-1111-2222',
    email: 'test@example.com',
    activityContent: '卓球の練習',
    hasMonthlyFee: true,
    memberType: '2',
    isApproved: true
  }
];

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // User Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mockUserDB, setMockUserDB] = useState<User[]>(MOCK_USERS);
  
  // States for Modals
  const [showDailyGrid, setShowDailyGrid] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  
  // Temporary state to pass from Grid to Form
  const [selectedSlot, setSelectedSlot] = useState<{room: RoomType, start: string, end: string} | null>(null);
  
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  // View state: 'home' | 'calendar' | 'access' | 'rules'
  const [currentView, setCurrentView] = useState('home');

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDailyGrid(true);
  };

  const handleSlotClick = (room: RoomType, slotId: string, startTime: string, endTime: string) => {
    setSelectedSlot({ room, start: startTime, end: endTime });
    setShowDailyGrid(false);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = (formData: any) => {
    if (!selectedDate || !selectedSlot) return;

    const newBooking: Booking = {
      id: Math.random().toString(36).substr(2, 9),
      date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
      room: selectedSlot.room,
      applicantName: formData.name,
      purpose: formData.purpose,
      category: formData.category,
      equipment: formData.equipment,
      price: formData.price,
      status: BookingStatus.PENDING
    };

    setBookings([...bookings, newBooking]);
    setShowBookingForm(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);
  };

  // Auth Handlers
  const handleLogin = (email: string) => {
    const user = mockUserDB.find(u => u.email === email);
    if (user) {
      setCurrentUser(user);
      setShowLoginForm(false);
    } else {
      alert('登録されていないメールアドレスです。');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleRegistrationSubmit = (newUser: User) => {
    setMockUserDB([...mockUserDB, newUser]);
    setShowRegistrationForm(false);
    setShowRegistrationSuccess(true);
    // Auto login for demo flow convenience, or just show success message
    // setCurrentUser(newUser); 
  };

  const NavItem = ({ view, label, icon: Icon }: { view: string, label: string, icon: any }) => (
    <button 
      onClick={() => setCurrentView(view)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
        currentView === view 
          ? 'bg-emerald-600 text-white shadow-md' 
          : 'text-gray-600 hover:bg-emerald-50'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('home')}>
            <div className="bg-emerald-600 p-1.5 rounded-lg">
                <Users className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">自治会館予約<span className="text-emerald-600">システム</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-2">
              <NavItem view="home" label="ホーム" icon={Menu} />
              <NavItem view="calendar" label="空き状況・予約" icon={CalendarIcon} />
              <NavItem view="access" label="アクセス" icon={MapPin} />
            </nav>

            {/* Login/User Status */}
            {currentUser ? (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm font-bold text-gray-700 hidden sm:inline">{currentUser.representative} 様</span>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                  title="ログアウト"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginForm(true)}
                className="flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700 ml-2"
              >
                <LogIn size={18} />
                <span className="hidden sm:inline">ログイン</span>
              </button>
            )}

            <button className="md:hidden text-gray-600">
               <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 animate-fade-in-down shadow-sm">
            <div className="bg-white p-1 rounded-full"><Info size={20} className="text-emerald-500"/></div>
            <div>
               <p className="font-bold">予約リクエストを送信しました！</p>
               <p className="text-sm">管理人からの承認メールをお待ちください。</p>
            </div>
          </div>
        )}

        {showRegistrationSuccess && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-200 text-blue-800 rounded-xl flex flex-col md:flex-row items-center gap-3 animate-fade-in-down shadow-sm relative">
             <button onClick={() => setShowRegistrationSuccess(false)} className="absolute top-2 right-2 text-blue-400 hover:text-blue-600"><X size={18}/></button>
            <div className="bg-white p-2 rounded-full"><CheckCircle size={24} className="text-blue-500"/></div>
            <div>
               <p className="font-bold text-lg">利用者登録申請を受け付けました</p>
               <p className="text-sm">
                 ご登録のメールアドレスに確認メールを送信します。管理者による承認後、ログインが可能になります。<br/>
                 <span className="text-xs text-gray-500">※デモ環境のため、現在はそのままログイン可能です。</span>
               </p>
            </div>
          </div>
        )}

        {currentView === 'home' && (
          <div className="space-y-8 animate-fade-in">
             <div className="relative rounded-3xl overflow-hidden shadow-xl h-64 md:h-80 bg-gray-900 group">
                <img 
                   src="https://picsum.photos/1200/600" 
                   alt="Community Center" 
                   className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white p-6">
                   <h2 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-md">地域をつなぐ、<br className="md:hidden"/>みんなの場所。</h2>
                   <p className="text-lg md:text-xl mb-8 text-gray-100 max-w-xl drop-shadow">
                      会議、サークル活動、レクリエーションなど。<br/>
                      どなたでも気軽にご利用いただけます。
                   </p>
                   <button 
                     onClick={() => setCurrentView('calendar')}
                     className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                   >
                      <CalendarIcon />
                      今すぐ予約状況を確認
                   </button>
                </div>
             </div>

             <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                   <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={24} />
                   </div>
                   <h3 className="font-bold text-lg mb-2">誰でも利用可能</h3>
                   <p className="text-gray-600 text-sm">
                      初めての方は<button onClick={() => setShowRegistrationForm(true)} className="text-emerald-600 underline hover:text-emerald-700">利用者登録</button>をお願いします。
                   </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                   <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CalendarIcon size={24} />
                   </div>
                   <h3 className="font-bold text-lg mb-2">Webで簡単予約</h3>
                   <p className="text-gray-600 text-sm">24時間いつでも空き状況を確認し、予約リクエストを送れます。</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                   <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Info size={24} />
                   </div>
                   <h3 className="font-bold text-lg mb-2">AIサポート</h3>
                   <p className="text-gray-600 text-sm">利用規約や設備について、AIアシスタントがチャットでお答えします。</p>
                </div>
             </div>
          </div>
        )}

        {currentView === 'calendar' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                   <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                      <CalendarIcon size={24} />
                   </div>
                   <div>
                     <h2 className="text-2xl font-bold text-gray-800">予約状況カレンダー</h2>
                     <p className="text-gray-500 text-sm">日付をクリックすると詳細な空き状況（時間割）が表示されます。</p>
                   </div>
                </div>
                
                <Calendar 
                  currentDate={currentDate} 
                  onPrevMonth={handlePrevMonth} 
                  onNextMonth={handleNextMonth} 
                  bookings={bookings}
                  onDateClick={handleDateClick}
                />

                <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                   <div className="flex items-center gap-2"><span className="w-3 h-3 bg-white border border-gray-300 rounded-full"></span>空きあり</div>
                   <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded-full"></span>混雑</div>
                   <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded-full"></span>満室</div>
                </div>
             </div>
          </div>
        )}

        {currentView === 'access' && (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-3xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                   <MapPin className="text-emerald-600" />
                   アクセス・お問い合わせ
                </h2>
                
                <div className="space-y-6">
                   <div className="aspect-video w-full bg-gray-200 rounded-xl overflow-hidden relative">
                      {/* Placeholder for map */}
                      <img src="https://picsum.photos/800/400" alt="Map" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white font-bold text-xl">
                         地図表示エリア (Google Maps等)
                      </div>
                   </div>

                   <div className="grid md:grid-cols-2 gap-8">
                      <div>
                         <h3 className="font-bold text-lg mb-2 text-gray-700">所在地</h3>
                         <p className="text-gray-600 leading-relaxed">
                            〒123-4567<br/>
                            〇〇県〇〇市〇〇町1-2-3<br/>
                            〇〇自治会館
                         </p>
                      </div>
                      <div>
                         <h3 className="font-bold text-lg mb-2 text-gray-700">連絡先</h3>
                         <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Phone size={18} />
                            <span>03-1234-5678 (管理人室)</span>
                         </div>
                         <p className="text-sm text-gray-500">
                            ※電話受付: 平日 9:00 - 17:00<br/>
                            緊急時以外はWeb予約をご利用ください。
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-8 text-center text-sm">
         <div className="max-w-5xl mx-auto px-4">
            <p className="mb-2">&copy; 2024 〇〇自治会 All Rights Reserved.</p>
            <p>このサイトは住民の利便性向上のために運営されています。</p>
         </div>
      </footer>

      {/* Modals & Overlays */}
      {showDailyGrid && selectedDate && (
        <DailyScheduleGrid 
          date={selectedDate}
          bookings={bookings.filter(b => b.date === `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`)}
          onClose={() => setShowDailyGrid(false)}
          onSelectSlot={handleSlotClick}
        />
      )}

      {showBookingForm && selectedDate && selectedSlot && (
        <BookingForm 
          selectedDate={selectedDate}
          initialRoom={selectedSlot.room}
          initialStartTime={selectedSlot.start}
          initialEndTime={selectedSlot.end}
          currentUser={currentUser}
          onCancel={() => setShowBookingForm(false)} 
          onSubmit={handleBookingSubmit} 
        />
      )}

      {showLoginForm && (
        <LoginForm 
          onCancel={() => setShowLoginForm(false)} 
          onLogin={handleLogin}
          onRegisterClick={() => {
            setShowLoginForm(false);
            setShowRegistrationForm(true);
          }}
        />
      )}

      {showRegistrationForm && (
        <RegistrationForm 
          onCancel={() => setShowRegistrationForm(false)} 
          onSubmit={handleRegistrationSubmit}
        />
      )}

      <Assistant />
    </div>
  );
}

export default App;