import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface PWAInstallDiagnostics {
    secureContext: boolean;
    serviceWorkerSupported: boolean;
    serviceWorkerRegistered: boolean;
    manifestLinked: boolean;
    manifestReachable: boolean;
    isAndroid: boolean;
    isChromeLike: boolean;
    isLikelyInAppBrowser: boolean;
}

declare global {
    interface Window {
        __JXNU_PWA__?: {
            deferredPrompt: BeforeInstallPromptEvent | null;
            isInstalled: boolean;
        };
    }

    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

const DEFAULT_DIAGNOSTICS: PWAInstallDiagnostics = {
    secureContext: true,
    serviceWorkerSupported: false,
    serviceWorkerRegistered: false,
    manifestLinked: false,
    manifestReachable: false,
    isAndroid: false,
    isChromeLike: false,
    isLikelyInAppBrowser: false,
};

export function usePWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [diagnostics, setDiagnostics] = useState<PWAInstallDiagnostics>(DEFAULT_DIAGNOSTICS);

    useEffect(() => {
        const ua = window.navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        const isAndroidDevice = /Android/i.test(ua);
        const isChromeLike = /Chrome|CriOS|EdgA|OPR|SamsungBrowser/i.test(ua);
        const isLikelyInAppBrowser = /MicroMessenger|QQ\//i.test(ua);

        setIsIOS(isIOSDevice);

        const pwaState = window.__JXNU_PWA__;
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        setIsInstalled(isStandalone || Boolean(pwaState?.isInstalled));
        setDeferredPrompt(pwaState?.deferredPrompt ?? null);
        setIsInstallable(Boolean(pwaState?.deferredPrompt));

        const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

        const refreshDiagnostics = async () => {
            let manifestReachable = false;
            const manifestUrl = manifestLink?.href || '/manifest.json';
            if (manifestUrl) {
                try {
                    const response = await fetch(manifestUrl, { cache: 'no-store' });
                    const contentType = response.headers.get('content-type') || '';
                    manifestReachable = response.ok && (contentType.includes('json') || contentType.includes('manifest'));
                } catch {
                    manifestReachable = false;
                }
            }

            let serviceWorkerRegistered = false;
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration('/');
                    serviceWorkerRegistered = Boolean(registration?.active || registration?.waiting || registration?.installing);
                } catch {
                    serviceWorkerRegistered = false;
                }
            }

            setDiagnostics({
                secureContext: window.isSecureContext,
                serviceWorkerSupported: 'serviceWorker' in navigator,
                serviceWorkerRegistered,
                manifestLinked: Boolean(manifestLink?.href || manifestUrl),
                manifestReachable,
                isAndroid: isAndroidDevice,
                isChromeLike,
                isLikelyInAppBrowser,
            });
        };

        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            if (window.__JXNU_PWA__) {
                window.__JXNU_PWA__.deferredPrompt = e;
            }
            setDeferredPrompt(e);
            setIsInstallable(true);
            void refreshDiagnostics();
        };

        const handleAppInstalled = () => {
            if (window.__JXNU_PWA__) {
                window.__JXNU_PWA__.isInstalled = true;
                window.__JXNU_PWA__.deferredPrompt = null;
            }
            setIsInstallable(false);
            setDeferredPrompt(null);
            setIsInstalled(true);
            void refreshDiagnostics();
        };

        const handleInstallableSync = () => {
            const deferred = window.__JXNU_PWA__?.deferredPrompt ?? null;
            setDeferredPrompt(deferred);
            setIsInstallable(Boolean(deferred));
            void refreshDiagnostics();
        };

        void refreshDiagnostics();

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);
        window.addEventListener('jxnu:pwa-installable', handleInstallableSync);
        window.addEventListener('jxnu:pwa-installed', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            window.removeEventListener('jxnu:pwa-installable', handleInstallableSync);
            window.removeEventListener('jxnu:pwa-installed', handleAppInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        const promptEvent = deferredPrompt ?? window.__JXNU_PWA__?.deferredPrompt ?? null;
        if (!promptEvent) {
            return false;
        }

        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;

        if (window.__JXNU_PWA__) {
            window.__JXNU_PWA__.deferredPrompt = null;
        }
        setDeferredPrompt(null);
        setIsInstallable(false);

        return outcome === 'accepted';
    }, [deferredPrompt]);

    return { isInstallable, isInstalled, isIOS, install, diagnostics };
}
