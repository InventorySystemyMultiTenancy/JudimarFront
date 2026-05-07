import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const I18N_API_URL = import.meta.env.VITE_I18N_URL || "http://localhost:3001";
const SISTEMA = "judimar";
const SISTEMA_FALLBACK = "website";
const DEFAULT_LOCALE = "pt-BR";
const STORAGE_NS = `i18n_${SISTEMA}`;
const ANON_LOCALE_KEY = `${STORAGE_NS}_locale`;
const LEGACY_ANON_LOCALE_KEY = "i18n_locale";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("i18n_debug") === "1";
}

function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log("[I18N_DEBUG][Context]", ...args);
  }
}

const I18nContext = createContext(null);

// ─── helpers de localStorage ────────────────────────────────────────────────

function readUserId() {
  try {
    const raw = localStorage.getItem("pc_user");
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
}

function localeStorageKey(userId) {
  return userId ? `${STORAGE_NS}_locale_${userId}` : ANON_LOCALE_KEY;
}

function readLocale(userId) {
  // Tenta chave do usuário (namespaced) → chave anônima (namespaced) → legado → padrão
  return (
    localStorage.getItem(localeStorageKey(userId)) ||
    localStorage.getItem(ANON_LOCALE_KEY) ||
    localStorage.getItem(LEGACY_ANON_LOCALE_KEY) ||
    DEFAULT_LOCALE
  );
}

function saveLocale(userId, locale) {
  localStorage.setItem(localeStorageKey(userId), locale);
  // Salva também na chave anônima como fallback para usuários não logados
  localStorage.setItem(ANON_LOCALE_KEY, locale);
}

function cacheKey(locale) {
  return `${STORAGE_NS}_cache_${locale}`;
}

function readCache(locale) {
  try {
    const raw = localStorage.getItem(cacheKey(locale));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null; // expirado
    return data;
  } catch {
    return null;
  }
}

function writeCache(locale, data) {
  try {
    localStorage.setItem(
      cacheKey(locale),
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    // localStorage cheio — ignora silenciosamente
  }
}

function clearCache(locale) {
  try {
    localStorage.removeItem(cacheKey(locale));
  } catch {
    // ignora silenciosamente
  }
}

// ─── fetch ──────────────────────────────────────────────────────────────────

async function fetchTranslations(locale) {
  debugLog("fetchTranslations:start", { locale });
  const primaryUrl = `${I18N_API_URL}/traducoes/${SISTEMA}/${encodeURIComponent(locale)}`;
  let res = await fetch(primaryUrl);
  debugLog("fetchTranslations:response", {
    locale,
    sistema: SISTEMA,
    status: res.status,
  });

  if (!res.ok && res.status === 404 && SISTEMA_FALLBACK !== SISTEMA) {
    const fallbackUrl = `${I18N_API_URL}/traducoes/${SISTEMA_FALLBACK}/${encodeURIComponent(locale)}`;
    res = await fetch(fallbackUrl);
    debugLog("fetchTranslations:fallback_response", {
      locale,
      sistema: SISTEMA_FALLBACK,
      status: res.status,
    });
  }

  if (!res.ok) throw new Error(`I18n fetch failed: ${res.status}`);

  const data = await res.json();
  debugLog("fetchTranslations:payload", {
    locale,
    totalKeys: Object.keys(data?.traducoes || {}).length,
  });
  return data;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }) {
  const [userId, setUserId] = useState(readUserId);
  const [locale, setLocaleState] = useState(() => readLocale(readUserId()));
  const [translations, setTranslations] = useState({});
  const [direction, setDirection] = useState("ltr");
  const [loading, setLoading] = useState(true);

  // Carrega traduções para o locale atual (cache + stale-while-revalidate)
  useEffect(() => {
    let cancelled = false;

    const apply = (data) => {
      setTranslations(data.traducoes || {});
      const dir = data.direcao || "ltr";
      setDirection(dir);
      document.documentElement.setAttribute("dir", dir);
      document.documentElement.setAttribute("lang", locale);
    };

    const cached = readCache(locale);
    debugLog("cache:read", {
      locale,
      hasCache: Boolean(cached),
      cachedKeys: Object.keys(cached?.traducoes || {}).length,
    });

    if (cached) {
      // Usa cache imediatamente — zero flash de carregamento
      apply(cached);
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(false);
      });

      // Atualiza em background (stale-while-revalidate)
      fetchTranslations(locale)
        .then((data) => {
          if (cancelled) return;
          writeCache(locale, data);
          debugLog("cache:write", {
            locale,
            keys: Object.keys(data?.traducoes || {}).length,
          });
          apply(data);
        })
        .catch(() => {
          /* mantém cache em uso */
        });
    } else {
      // Sem cache: busca com loading
      Promise.resolve().then(() => {
        if (!cancelled) setLoading(true);
      });
      fetchTranslations(locale)
        .then((data) => {
          if (cancelled) return;
          writeCache(locale, data);
          debugLog("cache:write", {
            locale,
            keys: Object.keys(data?.traducoes || {}).length,
          });
          apply(data);
        })
        .catch(() => {
          // Falha total: mantém traduções anteriores
          if (!cancelled) setLoading(false);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Reage a login/logout via evento disparado pelo AuthContext
  useEffect(() => {
    const handleAuthChange = (e) => {
      const newUser = e.detail?.user ?? null;
      const newUserId = newUser?.id ?? null;
      setUserId(newUserId);
      // Carrega o locale salvo desse usuário (ou anônimo)
      const savedLocale = readLocale(newUserId);
      setLocaleState(savedLocale);
    };

    window.addEventListener("pc_auth_change", handleAuthChange);
    return () => window.removeEventListener("pc_auth_change", handleAuthChange);
  }, []);

  const setLocale = useCallback(
    (newLocale) => {
      saveLocale(userId, newLocale);
      setLocaleState(newLocale);
    },
    [userId],
  );

  const t = useCallback(
    (key, fallback) => translations[key] ?? fallback ?? key,
    [translations],
  );

  const refreshTranslations = useCallback(async () => {
    try {
      const data = await fetchTranslations(locale);
      writeCache(locale, data);
      debugLog("refreshTranslations:applied", {
        locale,
        keys: Object.keys(data?.traducoes || {}).length,
      });

      setTranslations(data.traducoes || {});
      const dir = data.direcao || "ltr";
      setDirection(dir);
      document.documentElement.setAttribute("dir", dir);
      document.documentElement.setAttribute("lang", locale);
      return true;
    } catch {
      debugLog("refreshTranslations:error", { locale });
      return false;
    }
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        direction,
        loading,
        refreshTranslations,
        invalidateCache: clearCache,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook para consumir o contexto de I18n.
 * Uso: const { t, locale, setLocale, direction } = useTranslation();
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx)
    throw new Error("useTranslation deve ser usado dentro de I18nProvider");
  return ctx;
}
