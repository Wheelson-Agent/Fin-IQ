import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, FileText, CreditCard, Eye, ClipboardList, CheckSquare, XCircle,
  Settings, Users, BarChart3, ChevronRight, Zap, Bell, Search, Command, Sparkles, PanelLeft, PanelLeftClose, Package, Terminal, LogOut, KeyRound,
  /* SUPPLIER_360_START */ TrendingUp /* SUPPLIER_360_END */
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface SidebarProps {
  expanded: boolean;
  setExpanded: (val: boolean) => void;
}

const navItemsMain = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'ap-workspace', label: 'Accounts Payable  Workspace', path: '/ap-workspace', icon: CreditCard },
  { id: 'audit', label: 'Audit Trail', path: '/audit', icon: ClipboardList },
  { id: 'agent', label: 'Ask agent_fc', path: '/agent', icon: Sparkles, isAI: true, badge: 'AI', badgeColor: 'bg-[#6366F1]' },
];

const navItemsManage = [
  // Reports is admin-only — filtered out for operators inside the component.
  { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3, adminOnly: true },
  /* SUPPLIER_360_START — remove this line to uninstall Supplier 360 */
  { id: 'supplier360', label: 'Supplier 360', path: '/supplier360', icon: TrendingUp, badge: 'NEW', badgeColor: 'bg-[#10B981]' },
  /* SUPPLIER_360_END */
];

const navItemsSettings = [
  { id: 'config', label: 'Control Hub', path: '/config', icon: Settings },
  // Admin-only — filtered out for operators inside the component.
  { id: 'users', label: 'User Management', path: '/users', icon: Users, adminOnly: true },
];

export function Sidebar({ expanded, setExpanded }: SidebarProps) {
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  // Initials for the avatar — first char of each word, capped at two.
  const initials = (user?.display_name || user?.email || 'U')
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'U';
  // Drop admin-only items when the current user is an operator. Backend
  // enforces the same rule, so this is purely about not dangling a link
  // that would just redirect them.
  const settingsItems = navItemsSettings.filter(i => !i.adminOnly || isAdmin);
  const manageItems = navItemsManage.filter((i: any) => !i.adminOnly || isAdmin);

  // Constants to match the design spec
  const wCollapsed = 64;
  const wExpanded = 240;

  return (
    <motion.aside
      className="sidebar relative z-50 shrink-0"
      initial={{ width: wExpanded }}
      animate={{ width: expanded ? wExpanded : wCollapsed }}
      transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
    >
      <div className="absolute inset-0 bg-[#0B1623] flex flex-col overflow-hidden text-white border-r border-[#1C2836]">
        {/* Glow Effect */}
        <div className="absolute -top-[60px] -left-[40px] w-[200px] h-[200px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(30,111,217,0.18) 0%, transparent 70%)' }} />

        {/* Logo Area */}
        <div className="h-[56px] flex items-center justify-between px-[14px] shrink-0 overflow-hidden border-b border-white/5 relative z-10">
          <div className="flex items-center gap-[12px]">
            {/* The Logo / Collapsed Toggle */}
            <div
              className="relative w-[36px] h-[36px] flex items-center justify-center shrink-0 group/logo cursor-pointer"
              onClick={() => !expanded && setExpanded(true)}
              title={!expanded ? "Open sidebar" : undefined}
            >
              {/* Actual Logo */}
              <div className={`absolute inset-0 bg-[#1E6FD9] rounded-[10px] flex items-center justify-center shadow-[0_0_20px_rgba(30,111,217,0.35)] transition-opacity duration-200 ${!expanded ? 'group-hover/logo:opacity-0' : ''}`}>
                <Zap size={18} color="white" fill="white" />
              </div>

              {/* Hover Toggle Icon (Only shows when collapsed) */}
              {!expanded && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity duration-200 text-white/70 hover:text-white bg-white/10 rounded-[8px]">
                  <PanelLeft size={20} strokeWidth={2.5} />
                </div>
              )}
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap overflow-hidden flex flex-col justify-center"
                >
                  <div className="text-[14px] font-bold text-white tracking-[-0.2px] leading-[1.2]">agent_fc</div>
                  <div className="text-[9.5px] text-white/35 font-mono mt-[1px]">v2.4 · AI Powered</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Expanded Close Toggle */}
          {expanded && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpanded(false)}
              className="w-[28px] h-[28px] flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-[6px] hover:bg-white/10 cursor-pointer border-none bg-transparent"
              title="Close sidebar"
            >
              <PanelLeftClose size={18} strokeWidth={2.5} />
            </motion.button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-[4px] relative z-10 scrollbar-none">
          <NavSection title="MAIN" expanded={expanded} items={navItemsMain} setHoveredTooltip={setHoveredTooltip} />
          <NavSection title="MANAGE" expanded={expanded} items={manageItems} setHoveredTooltip={setHoveredTooltip} />
          <NavSection title="SETTINGS" expanded={expanded} items={settingsItems} setHoveredTooltip={setHoveredTooltip} />
        </div>

        {/* User menu — avatar + popover with change-password / sign-out.
            Replaces the Topbar popover so the account lives next to nav. */}
        {user && (
          <div className="py-[10px] border-t border-white/5 relative z-10">
            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={user.display_name || user.email}
                  className="w-full flex items-center gap-[10px] py-[8px] px-[14px] cursor-pointer text-white/60 hover:text-white hover:bg-white/5 transition-colors border-none bg-transparent text-left"
                >
                  <div className="w-[32px] h-[32px] rounded-full bg-[#1E6FD9] flex items-center justify-center text-[12px] font-bold text-white shrink-0 ring-2 ring-[#1E6FD9]/40">
                    {initials}
                  </div>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="overflow-hidden whitespace-nowrap min-w-0"
                      >
                        <div className="text-[12px] font-semibold text-white truncate">{user.display_name || 'Account'}</div>
                        <div className="text-[10px] text-white/40 font-mono truncate">{user.email}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="end" className="w-60 p-0">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-[13px] font-semibold text-slate-900 truncate">
                    {user.display_name || 'Signed in'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  {user.role && (
                    <div className="mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                      {user.role}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); navigate('/change-password'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <KeyRound size={14} />
                  Change password
                </button>
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); logout(); navigate('/login', { replace: true }); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Tooltips (only when collapsed) */}
      {!expanded && hoveredTooltip && (
        <div
          className="fixed z-[999] bg-[#162436] text-white text-[11.5px] font-semibold px-[10px] py-[5px] rounded-[7px] pointer-events-none shadow-[0_4px_16px_rgba(0,0,0,0.3)] border border-white/10"
          style={{
            left: '74px', // 64 + 10px spacing
            top: hoveredTooltip.split(':')[1],
            transform: 'translateY(-50%)',
          }}
        >
          {hoveredTooltip.split(':')[0]}
        </div>
      )}
    </motion.aside>
  );
}

function NavSection({ title, expanded, items, setHoveredTooltip }: any) {
  return (
    <div className="mb-1">
      {expanded ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-[8.5px] font-bold text-white/20 uppercase tracking-[1.4px] pt-[16px] pb-[5px] pl-[20px] whitespace-nowrap overflow-hidden"
        >
          {title}
        </motion.div>
      ) : (
        <div className="mx-[14px] my-[8px] h-px bg-white/[0.07] rounded-full" />
      )}
      <div className="flex flex-col">
        {items.map((item: any) => (
          <NavItem key={item.id} item={item} expanded={expanded} setHoveredTooltip={setHoveredTooltip} />
        ))}
      </div>
    </div>
  );
}

function NavItem({ item, expanded, setHoveredTooltip }: any) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `relative flex items-center gap-[12px] px-[14px] h-[44px] cursor-pointer whitespace-nowrap overflow-hidden transition-colors border-l-[3px] border-r-[3px] border-r-transparent group ${isActive
          ? 'text-white bg-[#1E6FD9]/20 border-l-[#1E6FD9]'
          : 'text-white/45 hover:text-white/85 hover:bg-white/5 border-l-transparent'
        }`
      }
      onMouseEnter={(e) => {
        if (!expanded) {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoveredTooltip(`${item.label}:${rect.top + rect.height / 2}px`);
        }
      }}
      onMouseLeave={() => setHoveredTooltip(null)}
    >
      {({ isActive }) => (
        <>
          {/* When collapsed, wrap icon in a pill for the active state */}
          {!expanded && isActive ? (
            <div className="w-[36px] h-[36px] rounded-[10px] bg-[#1E6FD9]/25 flex items-center justify-center shrink-0 -ml-[5px]">
              <Icon size={17} className="text-[#5B9FEF]" />
            </div>
          ) : (
            <motion.div
              className={`text-[18px] shrink-0 w-[22px] flex items-center justify-center ${isActive ? 'text-[#1E6FD9]' : ''}`}
              whileHover={{ scale: 1.15 }}
              transition={{ ease: [0.34, 1.56, 0.64, 1], duration: 0.2 }}
            >
              <Icon size={18} />
            </motion.div>
          )}
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-[12.5px] font-medium whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {expanded && item.badge && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`ml-auto min-w-[18px] h-[18px] px-[5px] rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 text-white ${item.badgeColor || 'bg-[#EF4444]'}`}
            >
              {item.badge}
            </motion.span>
          )}
        </>
      )}
    </NavLink>
  );
}
