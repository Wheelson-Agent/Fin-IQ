import React, { useState, useEffect } from 'react';
import { Package, Search, Filter, Plus, Tag, Hash, Scale, DollarSign, ExternalLink } from 'lucide-react';
import { getItems, saveItem } from '../lib/api';
import { useCompany } from '../context/CompanyContext';
import type { ItemMaster as ItemType } from '../lib/types';
import { SectionHeader } from '../components/at/SectionHeader';

export default function ItemMaster() {
    const { selectedCompany } = useCompany();
    const [items, setItems] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchItems = async () => {
        try {
            setLoading(true);
            const data = await getItems(selectedCompany);
            setItems(data || []);
        } catch (err) {
            console.error('[ItemMaster] Failed to fetch items:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
        window.addEventListener('app:refresh', fetchItems);
        return () => window.removeEventListener('app:refresh', fetchItems);
    }, [selectedCompany]);

    const filteredItems = items.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.hsn_sac?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (val: number | null) => val !== null ? `₹${val.toLocaleString()}` : '—';

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
            <div className="mb-6">
                <SectionHeader
                    title="Item Master"
                    description="Manage stock items, services, and HSN/SAC codes for Tally integration."
                />
            </div>

            {/* Stats Area */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Total Items</div>
                    <div className="text-[24px] font-black text-[#1A2640]">{items.length}</div>
                </div>
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Active Goods</div>
                    <div className="text-[24px] font-black text-[#10B981]">
                        {items.filter(i => i.is_active).length}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">Avg. Tax Rate</div>
                    <div className="text-[24px] font-black text-[#6366F1]">
                        {items.length > 0 ? (items.reduce((sum, i) => sum + (i.tax_rate || 0), 0) / items.length).toFixed(1) + '%' : '0%'}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[20px] border border-[#D0D9E8]/50 shadow-sm">
                    <div className="text-[11px] font-black text-[#8899AA] uppercase tracking-widest mb-1">In Sync</div>
                    <div className="text-[24px] font-black text-amber-500">85%</div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-4 gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8899AA]" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, code, or HSN..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-[40px] pl-10 pr-4 bg-white border border-[#D0D9E8] rounded-[10px] text-[13px] focus:outline-none focus:border-[#1E6FD9] transition-colors shadow-sm"
                    />
                </div>
                <button className="h-[40px] px-4 flex items-center gap-2 bg-[#1A2640] text-white rounded-[10px] text-[12px] font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
                    <Plus size={16} />
                    Create Item
                </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="group bg-white rounded-[24px] p-6 border border-[#D0D9E8]/50 shadow-[0_4px_20px_rgba(13,27,42,0.03)] hover:shadow-[0_8px_30px_rgba(13,27,42,0.08)] hover:border-blue-500/20 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-[14px] group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <Package size={20} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-100">
                                        {item.uom}
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${item.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                                        }`}>
                                        {item.is_active ? 'Active' : 'Inactive'}
                                    </div>
                                </div>
                            </div>

                            <h4 className="text-[17px] font-black text-[#1A2640] mb-1 truncate">{item.item_name}</h4>
                            <div className="flex items-center gap-1.5 text-[#8899AA] text-[11px] font-medium mb-5">
                                <span className="flex items-center gap-1 bg-[#F1F5F9] px-2 py-0.5 rounded text-[10px] font-bold text-[#475569]">
                                    <Hash size={10} /> {item.item_code || 'No SKU'}
                                </span>
                                <span className="flex items-center gap-1 bg-[#F1F5F9] px-2 py-0.5 rounded text-[10px] font-bold text-[#475569]">
                                    <Tag size={10} /> HSN: {item.hsn_sac || '—'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F1F5F9]">
                                <div>
                                    <div className="text-[9px] font-black text-[#8899AA] uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Scale size={10} /> Tax Rate
                                    </div>
                                    <div className="text-[15px] font-black text-[#1A2640]">{item.tax_rate ?? 0}%</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-[#8899AA] uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                                        <DollarSign size={10} /> Base Price
                                    </div>
                                    <div className="text-[15px] font-black text-blue-600">{formatCurrency(item.base_price)}</div>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between pt-4 border-t border-dashed border-[#F1F5F9]">
                                <span className="text-[10px] text-[#8899AA] font-medium italic">Auto-mapped to Tally Stock Item</span>
                                <ExternalLink size={14} className="text-[#8899AA] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
