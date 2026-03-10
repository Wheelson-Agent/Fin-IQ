import React, { useState, useEffect } from 'react';
import { Users, Building2, Search, Filter, ArrowUpRight, ChevronRight, MapPin } from 'lucide-react';
import { getVendors } from '../lib/api';
import { useCompany } from '../context/CompanyContext';
import type { Vendor } from '../lib/types';
import { SectionHeader } from '../components/at/SectionHeader';

export default function Vendors() {
    const { selectedCompany } = useCompany();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchVendors = async () => {
        try {
            setLoading(true);
            const data = await getVendors(selectedCompany);
            setVendors(data || []);
        } catch (err) {
            console.error('[Vendors] Failed to fetch vendors:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVendors();
        window.addEventListener('app:refresh', fetchVendors);
        return () => window.removeEventListener('app:refresh', fetchVendors);
    }, [selectedCompany]);

    const filteredVendors = vendors.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (val: number) => `₹${val.toLocaleString()}`;

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="mb-6">
                <SectionHeader
                    title="Vendor Master"
                />
            </div>

            {/* Stats Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Total Vendors</div>
                    <div className="text-[24px] font-black text-[#1A2640]">{vendors.length}</div>
                </div>
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Total Outstanding</div>
                    <div className="text-[24px] font-black text-[#10B981]">
                        {formatCurrency(vendors.reduce((sum, v) => sum + (v.total_due || 0), 0))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Average Invoices/Vendor</div>
                    <div className="text-[24px] font-black text-[#6366F1]">
                        {vendors.length > 0 ? (vendors.reduce((sum, v) => sum + (v.invoice_count || 0), 0) / vendors.length).toFixed(1) : '0'}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-4 gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8899AA]" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or GSTIN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-[40px] pl-10 pr-4 bg-white border border-[#D0D9E8] rounded-[10px] text-[13px] focus:outline-none focus:border-[#1E6FD9] transition-colors shadow-sm"
                    />
                </div>
                <button className="h-[40px] px-4 flex items-center gap-2 bg-[#1A2640] text-white rounded-[10px] text-[12px] font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
                    <Users size={16} />
                    Add Vendor
                </button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
                    {filteredVendors.map((vendor) => (
                        <div
                            key={vendor.id}
                            className="group bg-white rounded-[24px] p-6 border border-[#D0D9E8]/50 shadow-[0_4px_20px_rgba(13,27,42,0.03)] hover:shadow-[0_8px_30px_rgba(13,27,42,0.08)] hover:border-blue-500/20 transition-all cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-[14px] group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Building2 size={20} />
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${(vendor.total_due || 0) > 100000 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    }`}>
                                    {(vendor.total_due || 0) > 100000 ? 'High Volume' : 'Active'}
                                </div>
                            </div>

                            <h4 className="text-[16px] font-black text-[#1A2640] mb-1 truncate">{vendor.name}</h4>
                            <div className="flex items-center gap-1.5 text-[#8899AA] text-[11px] font-medium mb-5">
                                <span className="bg-[#F1F5F9] px-2 py-0.5 rounded text-[10px] font-bold text-[#475569]">GSTIN</span>
                                {vendor.gstin || 'Unrecorded'}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F1F5F9]">
                                <div>
                                    <div className="text-[9px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Invoices</div>
                                    <div className="text-[14px] font-black text-[#1A2640]">{vendor.invoice_count || 0}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Total Due</div>
                                    <div className="text-[14px] font-black text-blue-600">{formatCurrency(vendor.total_due || 0)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
