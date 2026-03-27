import { Building2, Home, DollarSign, TrendingUp, Newspaper, Calendar } from 'lucide-react';
import { useAppStore } from '@/store';
import { ModuleType } from '@/types';
import { BT } from '@/components/deal/bloomberg-ui';

const MODULE_COLORS: Record<string, string> = {
  blue: BT.text.cyan,
  indigo: BT.text.cyan,
  green: BT.text.green,
  purple: BT.text.purple,
  orange: BT.text.orange,
  pink: BT.text.red,
};

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
        const accentColor = MODULE_COLORS[module.color] || BT.text.cyan;

        return (
          <button
            key={module.type}
            onClick={() => toggleModule(module.type)}
            className="w-full flex items-center gap-3 p-3 transition-all"
            style={{
              borderRadius: 0,
              background: isActive ? `${accentColor}11` : BT.bg.panelAlt,
              border: `2px solid ${isActive ? accentColor : BT.border.subtle}`,
            }}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: isActive ? accentColor : BT.text.muted }}
            />
            <span
              className="font-medium"
              style={{
                color: isActive ? BT.text.primary : BT.text.secondary,
                fontFamily: BT.font.label,
              }}
            >
              {module.label}
            </span>
            {isActive && (
              <div className="ml-auto">
                <div
                  className="w-2 h-2"
                  style={{ background: accentColor, borderRadius: '50%' }}
                ></div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
