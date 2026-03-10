import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'color' | 'mono';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'color',
    toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('app-theme') as Theme) || 'color';
    });

    useEffect(() => {
        if (theme === 'mono') {
            document.body.classList.add('theme-mono');
        } else {
            document.body.classList.remove('theme-mono');
        }
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme: setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
