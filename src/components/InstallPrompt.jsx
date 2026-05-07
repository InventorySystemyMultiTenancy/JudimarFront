import { useEffect, useState } from "react";

const STORAGE_KEY = "pc_install_prompt_dismissed";

function isMobileDevice() {
  return window.matchMedia?.("(max-width: 768px)")?.matches;
}

function isStandaloneMode() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return isStandaloneMode();
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return isMobileDevice();
  });
  const [isIos, setIsIos] = useState(() => {
    if (typeof window === "undefined") return false;
    return isIosDevice();
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const syncDeviceState = () => {
      setIsMobile(mediaQuery.matches);
      setIsIos(isIosDevice());
    };

    syncDeviceState();

    const handleBeforeInstallPrompt = (event) => {
      if (!isMobileDevice()) {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem(STORAGE_KEY);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    mediaQuery.addEventListener("change", syncDeviceState);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
      mediaQuery.removeEventListener("change", syncDeviceState);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.body.classList.toggle(
      "install-prompt-open",
      (!!deferredPrompt || (isIos && isMobile)) && !dismissed && !isInstalled,
    );

    return () => {
      document.body.classList.remove("install-prompt-open");
    };
  }, [deferredPrompt, dismissed, isInstalled, isIos, isMobile]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  if (dismissed || isInstalled || !isMobile) return null;

  const showIosInstructions = isIos && !deferredPrompt;

  if (!deferredPrompt && !showIosInstructions) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-3xl border border-gold/30 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm font-bold text-gray-900">
        Instale o app do Judimar
      </p>
      {showIosInstructions ? (
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          No iPhone, toque em Compartilhar e depois em Adicionar a Tela de
          Inicio.
        </p>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          Abra mais rápido no celular e use como se fosse um app na tela
          inicial.
        </p>
      )}
      <div className="mt-4 flex gap-2">
        {!showIosInstructions ? (
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-2xl bg-rosso px-4 py-3 text-sm font-bold text-white transition hover:bg-ember"
          >
            Instalar
          </button>
        ) : (
          <div className="flex-1 rounded-2xl bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-800">
            Safari iPhone
          </div>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-500 transition hover:border-gray-300 hover:text-gray-800"
        >
          Agora nao
        </button>
      </div>
    </aside>
  );
}

export default InstallPrompt;
