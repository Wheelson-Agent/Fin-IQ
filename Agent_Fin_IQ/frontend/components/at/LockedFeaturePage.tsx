import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Sparkles, CheckCircle, ArrowRight, Zap, Star, Crown } from 'lucide-react';

interface LockedFeatureProps {
    featureName: string;
    tagline: string;
    features: { icon: React.ReactNode; title: string; desc: string }[];
    previewRows?: { col1: string; col2: string; col3: string; col4: string }[];
    accentColor?: string;
    accentColor2?: string;
}

/* ─── Orbiting ring ─────────────────────────────────────── */
function OrbitRing({ radius, duration, reverse }: { radius: number; duration: number; reverse?: boolean }) {
    return (
        <motion.div
            className="absolute rounded-full border border-white/10"
            style={{ width: radius * 2, height: radius * 2, left: '50%', top: '50%', marginLeft: -radius, marginTop: -radius }}
            animate={{ rotate: reverse ? -360 : 360 }}
            transition={{ duration, repeat: Infinity, ease: 'linear' }}
        >
            {/* Dot on ring */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[8px] h-[8px] rounded-full bg-white/30" />
        </motion.div>
    );
}

/* ─── Floating particle ─────────────────────────────────── */
function FloatingParticle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
    return (
        <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, background: color }}
            animate={{ y: [-8, 8, -8], opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 3 + delay, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
    );
}

const particles = [
    { x: 8, y: 20, size: 6, delay: 0, color: 'rgba(30,111,217,0.6)' },
    { x: 88, y: 15, size: 4, delay: 0.5, color: 'rgba(124,58,237,0.6)' },
    { x: 15, y: 75, size: 8, delay: 1, color: 'rgba(30,111,217,0.4)' },
    { x: 78, y: 70, size: 5, delay: 1.5, color: 'rgba(124,58,237,0.5)' },
    { x: 50, y: 10, size: 4, delay: 0.8, color: 'rgba(255,255,255,0.3)' },
    { x: 92, y: 48, size: 6, delay: 2, color: 'rgba(30,111,217,0.5)' },
    { x: 5, y: 50, size: 4, delay: 1.2, color: 'rgba(124,58,237,0.4)' },
    { x: 60, y: 85, size: 7, delay: 0.3, color: 'rgba(255,255,255,0.2)' },
];

export function LockedFeaturePage({
    featureName, tagline, features, previewRows = [], accentColor = '#1E6FD9', accentColor2 = '#7C3AED'
}: LockedFeatureProps) {
    const [unlockHover, setUnlockHover] = useState(false);
    const [shimmer, setShimmer] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setShimmer(s => !s), 3000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="font-sans min-h-[80vh] flex flex-col gap-[28px]">
            {/* ─── Hero locked panel ─── */}
            <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                className="relative rounded-[24px] overflow-hidden flex flex-col items-center justify-center text-center py-[72px] px-[40px]"
                style={{ background: `linear-gradient(135deg, #0B1623 0%, #1A2738 40%, #0F1F44 100%)`, minHeight: 420 }}
            >
                {/* Background glow blobs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-80px] left-[20%] w-[400px] h-[400px] rounded-full"
                        style={{ background: `radial-gradient(circle, ${accentColor}30 0%, transparent 70%)`, filter: 'blur(40px)' }} />
                    <div className="absolute bottom-[-60px] right-[10%] w-[300px] h-[300px] rounded-full"
                        style={{ background: `radial-gradient(circle, ${accentColor2}25 0%, transparent 70%)`, filter: 'blur(40px)' }} />
                </div>

                {/* Floating particles */}
                {particles.map((p, i) => <FloatingParticle key={i} {...p} />)}

                {/* Lock atom */}
                <div className="relative mb-[36px]">
                    <OrbitRing radius={70} duration={8} />
                    <OrbitRing radius={95} duration={13} reverse />
                    <OrbitRing radius={120} duration={18} />

                    {/* Core lock */}
                    <motion.div
                        className="relative w-[80px] h-[80px] rounded-[22px] flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor2})`, boxShadow: `0 0 60px ${accentColor}60, 0 0 120px ${accentColor2}30` }}
                        animate={{
                            boxShadow: shimmer
                                ? [`0 0 60px ${accentColor}60, 0 0 120px ${accentColor2}30`, `0 0 90px ${accentColor}80, 0 0 160px ${accentColor2}50`, `0 0 60px ${accentColor}60, 0 0 120px ${accentColor2}30`]
                                : undefined
                        }}
                        transition={{ duration: 1.5 }}
                        whileHover={{ scale: 1.1, rotate: [-2, 2, 0] }}
                    >
                        <Lock size={36} className="text-white" strokeWidth={2.5} />

                        {/* Crown badge */}
                        <motion.div
                            className="absolute -top-[10px] -right-[10px] w-[26px] h-[26px] rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        >
                            <Crown size={12} className="text-white" fill="white" />
                        </motion.div>
                    </motion.div>
                </div>

                {/* Text */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center justify-center gap-[8px] mb-[10px]">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[3px]">Premium Add-on</span>
                    </div>
                    <h2 className="text-[32px] font-black text-white m-0 leading-tight mb-[10px]">{featureName}</h2>
                    <p className="text-[15px] text-white/55 m-0 max-w-[480px] leading-relaxed">{tagline}</p>
                </motion.div>

                {/* CTA */}
                <motion.div
                    className="mt-[36px] flex flex-col items-center gap-[12px]"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                >
                    <motion.button
                        onHoverStart={() => setUnlockHover(true)}
                        onHoverEnd={() => setUnlockHover(false)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative flex items-center gap-[10px] text-white font-black text-[14px] px-[32px] py-[14px] rounded-[14px] border-none cursor-pointer overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor2})`, boxShadow: `0 8px 32px ${accentColor}50` }}
                    >
                        {/* Shimmer sweep */}
                        <AnimatePresence>
                            {unlockHover && (
                                <motion.div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)' }}
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '200%' }}
                                    transition={{ duration: 0.5 }}
                                />
                            )}
                        </AnimatePresence>
                        <Sparkles size={16} />
                        Unlock {featureName}
                        <ArrowRight size={16} />
                    </motion.button>
                    <div className="text-[11px] text-white/30 font-semibold">Available in Pro & Enterprise plans</div>
                </motion.div>
            </motion.div>

            {/* ─── Blurred preview table ─── */}
            {previewRows.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="relative rounded-[16px] overflow-hidden border border-[#D0D9E8]/50 shadow-sm"
                >
                    {/* Overlay */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                        style={{ background: 'rgba(248,250,252,0.88)', backdropFilter: 'blur(6px)' }}>
                        <Lock size={28} className="text-[#CBD5E1] mb-[8px]" />
                        <div className="text-[14px] font-bold text-[#64748B]">Preview locked — upgrade to access</div>
                    </div>
                    <table className="w-full border-collapse pointer-events-none select-none">
                        <thead>
                            <tr className="h-[44px] bg-gradient-to-r from-[#0B1623] to-[#1A2738]">
                                {['Record', 'Info', 'Value', 'Status'].map(h => (
                                    <th key={h} className="px-[16px] text-[12px] font-bold text-white text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewRows.map((row, i) => (
                                <tr key={i} className={`h-[52px] border-b border-[#D0D9E8]/40 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}`}>
                                    <td className="px-[16px] text-[13px] font-bold text-[#1A2640]">{row.col1}</td>
                                    <td className="px-[16px] text-[13px] text-[#4A5568]">{row.col2}</td>
                                    <td className="px-[16px] text-[13px] text-[#4A5568]">{row.col3}</td>
                                    <td className="px-[16px] text-[13px] text-[#4A5568]">{row.col4}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            {/* ─── Feature highlights ─── */}
            <motion.div
                className="grid grid-cols-3 gap-[16px]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
            >
                {features.map((f, i) => (
                    <motion.div
                        key={i}
                        className="bg-white border border-[#D0D9E8]/50 rounded-[16px] p-[22px] flex flex-col gap-[12px] shadow-sm"
                        whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(30,111,217,0.12)' }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center text-white"
                            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor2})` }}>
                            {f.icon}
                        </div>
                        <div>
                            <div className="text-[13px] font-bold text-[#1A2640] mb-[4px]">{f.title}</div>
                            <div className="text-[11.5px] text-[#8899AA] leading-relaxed">{f.desc}</div>
                        </div>
                        <div className="flex items-center gap-[6px] text-[11px] font-bold mt-auto" style={{ color: accentColor }}>
                            <CheckCircle size={12} /> Included in upgrade
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
