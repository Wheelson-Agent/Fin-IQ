import React, { createContext, useContext, useState } from 'react';

interface DateContextType {
    dateFilter: string;
    setDateFilter: (filter: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: React.ReactNode }) {
    const [dateFilter, setDateFilter] = useState<string>('All');

    return (
        <DateContext.Provider value={{ dateFilter, setDateFilter }}>
            {children}
        </DateContext.Provider>
    );
}

export function useDateFilter() {
    const context = useContext(DateContext);
    if (context === undefined) {
        throw new Error('useDateFilter must be used within a DateProvider');
    }
    return context;
}
