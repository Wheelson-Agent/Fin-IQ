import React, { createContext, useContext, useState } from 'react';

export type DateRangeValue = {
    from: Date | undefined;
    to: Date | undefined;
    label: string;
};

interface DateContextType {
    dateFilter: DateRangeValue;
    setDateFilter: (filter: DateRangeValue) => void;
}

const defaultRange: DateRangeValue = {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    label: 'This Month'
};

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: React.ReactNode }) {
    const [dateFilter, setDateFilter] = useState<DateRangeValue>(defaultRange);

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
