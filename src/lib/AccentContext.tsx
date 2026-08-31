import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const ACCENTS = {
  ruby: { label: "Rubi", value: "#e11d48" },
  violet: { label: "Violeta", value: "#8b5cf6" },
  blue: { label: "Azul elétrico", value: "#3b82f6" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

const AccentCtx = createContext<{ accent: AccentKey; setAccent: (a: AccentKey) => void }>({
  accent: "ruby",
  setAccent: () => {},
});

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<AccentKey>(() => {
    const saved = localStorage.getItem("nitrodeck-accent");
    return saved && saved in ACCENTS ? (saved as AccentKey) : "ruby";
  });

  useEffect(() => {
    const value = ACCENTS[accent].value;
    document.documentElement.style.setProperty("--accent", value);
    document.documentElement.style.setProperty("--accent-soft", value + "29");
    localStorage.setItem("nitrodeck-accent", accent);
  }, [accent]);

  return <AccentCtx.Provider value={{ accent, setAccent }}>{children}</AccentCtx.Provider>;
}

export function useAccent() {
  return useContext(AccentCtx);
}
