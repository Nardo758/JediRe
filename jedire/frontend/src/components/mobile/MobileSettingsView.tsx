import { ChevronRight, Package, CreditCard, Users, Shield, Bell, Map, Palette, MapPin, HelpCircle, MessageCircle, Mail, Info, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function SettingsItem({ icon, label, onClick }: SettingsItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{icon}</span>
        <span className="text-gray-900">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}

export default function MobileSettingsView() {
  const { user, logout } = useAuth();

  return (
    <div className="pt-14 pb-20">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="bg-white/10 backdrop-blur rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {user?.name?.charAt(0) || 'L'}
            </div>
            <div className="text-white">
              <h3 className="font-bold text-lg">{user?.name || 'Leon Doe'}</h3>
              <p className="text-sm opacity-80">{user?.email || 'leon@example.com'}</p>
              <p className="text-xs opacity-60">Active Investor</p>
            </div>
          </div>
          <button className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium">
            Edit Profile →
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="px-4 py-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</h4>
        </div>
        <div className="bg-white border-y border-gray-200">
          <SettingsItem icon={<Package className="w-5 h-5" />} label="Modules & Subscription" />
          <SettingsItem icon={<CreditCard className="w-5 h-5" />} label="Billing & Payment" />
          <SettingsItem icon={<Users className="w-5 h-5" />} label="Team Members" />
          <SettingsItem icon={<Shield className="w-5 h-5" />} label="Privacy & Security" />
        </div>
      </div>

      <div className="mt-4">
        <div className="px-4 py-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferences</h4>
        </div>
        <div className="bg-white border-y border-gray-200">
          <SettingsItem icon={<Bell className="w-5 h-5" />} label="Notifications" />
          <SettingsItem icon={<Map className="w-5 h-5" />} label="Map Settings" />
          <SettingsItem icon={<Palette className="w-5 h-5" />} label="Appearance" />
          <SettingsItem icon={<MapPin className="w-5 h-5" />} label="Default Markets" />
        </div>
      </div>

      <div className="mt-4">
        <div className="px-4 py-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Help & Support</h4>
        </div>
        <div className="bg-white border-y border-gray-200">
          <SettingsItem icon={<HelpCircle className="w-5 h-5" />} label="Help Center" />
          <SettingsItem icon={<MessageCircle className="w-5 h-5" />} label="Contact Support" />
          <SettingsItem icon={<Mail className="w-5 h-5" />} label="Send Feedback" />
          <SettingsItem icon={<Info className="w-5 h-5" />} label="About JediRe" />
        </div>
      </div>

      <div className="p-4 mt-4">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>

      <div className="text-center text-xs text-gray-400 pb-4">
        JediRe v1.0.0 | © 2026
      </div>
    </div>
  );
}
