import React from 'react';
import { motion } from 'motion/react';

interface KPICardProps {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  index: number;
  sparkData?: number[];
}

export function KPICard({ label, value, trend, trendValue, icon, index, sparkData }: KPICardProps) {
  const kpiColor = index === 1 ? '#1E6FD9' :
    index === 2 ? '#22C55E' :
      index === 3 ? '#F59E0B' : '#EF4444';

  return (
    <div
      className="group relative overflow-hidden bg-white/70 backdrop-blur-md border border-white/40 rounded-[20px] p-[24px] shadow-[0_8px_32px_rgba(13,27,42,0.04)] transition-all duration-300 hover:shadow-[0_20px_48px_rgba(13,27,42,0.08)] hover:-translate-y-1 cursor-pointer"
    >
      {/* Decorative Glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ backgroundColor: kpiColor }}
      />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-[0.15em] mb-1">
            {label}
          </div>
          <div className="text-[32px] font-black text-[#1A2640] tracking-tighter font-sans">
            {value}
          </div>
        </div>
        <div
          className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-sm relative overflow-hidden"
          style={{ backgroundColor: `${kpiColor}15` }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundColor: kpiColor }} />
          <div style={{ color: kpiColor }}>{icon}</div>
        </div>
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div className={`text-[12px] font-black flex items-center gap-1.5 ${trend === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
          <div className={`p-1 rounded-md ${trend === 'up' ? 'bg-[#22C55E]/10' : 'bg-[#EF4444]/10'}`}>
            {trend === 'up' ? '▲' : '▼'}
          </div>
          {trendValue}
        </div>

        {/* Mini Sparkline */}
        {sparkData && (
          <div className="w-20 h-8 flex items-end gap-1 px-1">
            {sparkData.slice(-5).map((v, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(v / Math.max(...sparkData)) * 100}%` }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                className="w-1.5 rounded-full"
                style={{ backgroundColor: `${kpiColor}${i === 4 ? 'ff' : '40'}` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
