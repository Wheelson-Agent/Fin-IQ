import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCompanies } from '../lib/api';
import type { Company } from '../lib/types';

interface CompanyContextType {
    companies: Company[];
    selectedCompany: string; // 'ALL' or Company ID
    selectedCompanyName: string;
    setSelectedCompany: (id: string) => void;
    refreshCompanies: () => Promise<void>;
    loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompanyState] = useState<string>(() => {
        return localStorage.getItem('selected_company_id') || 'ALL';
    });
    const [loading, setLoading] = useState(true);

    const refreshCompanies = useCallback(async () => {
        try {
            const data = await getCompanies();
            setCompanies(data || []);
            // If localStorage holds a company that no longer exists or is inactive, reset to ALL.
            // This prevents stale UUIDs from silently scoping all data to a deregistered company.
            const stored = localStorage.getItem('selected_company_id');
            if (stored && stored !== 'ALL' && !data?.find((c: Company) => c.id === stored)) {
                setSelectedCompanyState('ALL');
                localStorage.setItem('selected_company_id', 'ALL');
            }
        } catch (err) {
            console.error('[CompanyContext] Failed to fetch companies:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshCompanies();
    }, [refreshCompanies]);

    const setSelectedCompany = (id: string) => {
        setSelectedCompanyState(id);
        localStorage.setItem('selected_company_id', id);
        // Trigger a custom event for components to react to company change if needed
        window.dispatchEvent(new CustomEvent('app:company-change', { detail: id }));
    };

    const selectedCompanyName = selectedCompany === 'ALL'
        ? 'All Companies'
        : (companies.find(c => c.id === selectedCompany)?.name || 'Selected Company');

    return (
        <CompanyContext.Provider value={{
            companies,
            selectedCompany,
            selectedCompanyName,
            setSelectedCompany,
            refreshCompanies,
            loading
        }}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
}
