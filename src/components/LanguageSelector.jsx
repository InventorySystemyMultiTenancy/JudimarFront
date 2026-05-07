import { useState, useRef, useEffect } from "react";
import { useTranslation } from "../context/I18nContext.jsx";

const LOCALES = [
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "pt-PT", label: "Português (PT)", flag: "🇵🇹" },
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "ar-MA", label: "العربية", flag: "🇲🇦" },
];

export default function LanguageSelector() {
  const { locale, setLocale, loading } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LOCALES.find((l) => l.code === locale) || LOCALES[0];

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        title="Idioma / Language"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="hidden sm:inline max-w-[70px] truncate">
          {current.label}
        </span>
        <svg
          className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Selecionar idioma"
          className="absolute right-0 z-50 mt-1 w-44 rounded-2xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {LOCALES.map((lang) => (
            <li
              key={lang.code}
              role="option"
              aria-selected={lang.code === locale}
              onClick={() => {
                setLocale(lang.code);
                setOpen(false);
              }}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 ${
                lang.code === locale
                  ? "font-semibold text-rosso"
                  : "text-gray-700"
              }`}
            >
              <span aria-hidden="true">{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === locale && (
                <svg
                  className="ml-auto h-4 w-4 text-rosso"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
