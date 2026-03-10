import React from 'react';

interface SectionHeaderProps {
  number?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ number, title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-[12px] border-b border-[#E2E8F0] pb-[16px] mb-[20px]">
      <span className="text-[15px] font-extrabold text-[#1A2640] tracking-tight">
        {title}
      </span>
      {action && <div className="ml-auto text-[12px] text-[#64748B] font-medium">{action}</div>}
    </div>
  );
}
