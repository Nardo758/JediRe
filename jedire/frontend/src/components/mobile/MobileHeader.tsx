import { Menu, Search, Bell, User } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  onMenuOpen?: () => void;
}

export default function MobileHeader({ title, onMenuOpen }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 safe-area-top">
      <div className="flex items-center justify-between px-4 h-14">
        <button
          onClick={onMenuOpen}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>

        <h1 className="font-bold text-gray-900">{title}</h1>

        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Search className="w-5 h-5 text-gray-700" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-5 h-5 text-gray-700" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <User className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>
    </header>
  );
}
