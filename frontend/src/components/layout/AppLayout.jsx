import React, { useState } from 'react';
import MobileHeader from './MobileHeader';
import HomeTab from '../student/HomeTab';
import ScheduleTab from '../student/ScheduleTab';
import ExchangeHubTab from '../student/ExchangeHubTab';
import ProfileTab from '../student/ProfileTab';
import GoalsTab from '../student/GoalsTab';
import DelegateTab from '../student/DelegateTab';
import AlertsTab from '../student/AlertsTab';

/**
 * AppLayout Component
 * @description Main application shell wrapper combining sticky MobileHeader,
 * scrollable main content viewport, floating navigation dock, and responsive container layout.
 */
export default function AppLayout({
  studentName = "طالب منار",
  unreadNotifications = 2,
  userProfile = null,
  onAvatarClick = () => {},
  onNotificationClick = () => {},
  children
}) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="h-screen w-full bg-[#070b13] text-white flex flex-col overflow-hidden relative selection:bg-amber-500/30">
      
      {/* 1. Header (Sticky Top Glassmorphic Navigation) */}
      <MobileHeader
        studentName={studentName}
        unreadNotifications={unreadNotifications}
        avatarUrl={userProfile?.idPhotoUrl}
        onAvatarClick={onAvatarClick}
        onNotificationClick={onNotificationClick}
      />

      {/* 2. Main Scrollable Viewport Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 no-scrollbar scroll-smooth">
        {children ? (
          children
        ) : (
          <>
            {activeTab === 'home' && <HomeTab />}
            {activeTab === 'schedule' && <ScheduleTab />}
            {activeTab === 'exchange' && <ExchangeHubTab />}
            {activeTab === 'goals' && <GoalsTab />}
            {activeTab === 'alerts' && <AlertsTab />}
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'delegate' && <DelegateTab />}
          </>
        )}
      </main>

    </div>
  );
}
