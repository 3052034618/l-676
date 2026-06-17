import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  trend?: number;
  iconColor?: string;
}

export default function StatCard({ icon: Icon, value, label, trend, iconColor = 'var(--color-accent)' }: StatCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="card flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold font-mono-number" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            {isPositive ? (
              <TrendingUp size={14} style={{ color: 'var(--color-success)' }} />
            ) : (
              <TrendingDown size={14} style={{ color: 'var(--color-danger)' }} />
            )}
            <span style={{ color: isPositive ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {isPositive ? '+' : ''}{trend}%
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>较上周</span>
          </div>
        )}
      </div>
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${iconColor}20`, color: iconColor }}
      >
        <Icon size={22} />
      </div>
    </div>
  );
}
