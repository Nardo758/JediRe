import { Building2, Home, DollarSign, TrendingUp, Newspaper, Calendar } from 'lucide-react';
import { useAppStore } from '@/store';
import { ModuleType } from '@/types';

const modules: { type: ModuleType; label: string; icon: any; color: string }[] = [
  { type: 'zoning', label: 'Zoning', icon: Building2, color: 'blue' },
  { type: 'supply', label: 'Supply', icon: Home, color: 'indigo' },
  { type: 'cashflow', label: 'Cash Flow', icon: DollarSign, color: 'green' },
  { type: 'demand', label: 'Demand', icon: TrendingUp, color: 'purple' },
  { type: 'news', label: 'News', icon: Newspaper, color: 'orange' },
  { type: 'events', label: 'Events', icon: Calendar, color: 'pink' },
];

export default function ModuleToggle() {
  const { activeModules, toggleModule } = useAppStore();

  return (
    <div className="p-4 space-y-2">
      {modules.map((module) => {
        const Icon = module.icon;
        const isActive = activeModules.includes(module.type);

        return (
          <button
            key={module.type}
            onClick={() => toggleModule(module.type)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
              isActive
                ? `bg-${module.color}-50 border-2 border-${module.color}-500`
                : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Icon
              className={`w-5 h-5 ${
                isActive ? `text-${module.color}-600` : 'text-gray-400'
              }`}
            />
            <span
              className={`font-medium ${
                isActive ? `text-${module.color}-900` : 'text-gray-600'
              }`}
            >
              {module.label}
            </span>
            {isActive && (
              <div className="ml-auto">
                <div className={`w-2 h-2 bg-${module.color}-500 rounded-full`}></div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
