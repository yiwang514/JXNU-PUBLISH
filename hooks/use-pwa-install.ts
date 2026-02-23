import { useState, useEffect, useCallback } from 'react';

// 扩展全局 Window 接口以包含 beforeinstallprompt 事件
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

export function usePWAInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 检测是否在 iOS 上的 Safari (iOS 不支持 beforeinstallprompt，仅支持手动添加到主屏)
        const ua = window.navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        setIsIOS(isIOSDevice);

        // 检测是否已安装（standalone）
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);

        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            // 防止 Chrome 67 以前自动显示横幅
            e.preventDefault();
            // 存储事件以便稍后触发
            setDeferredPrompt(e);
            // 更新 UI 去显示安装按钮
            setIsInstallable(true);
        };

        const handleAppInstalled = () => {
            // 控制已安装后清空
            setIsInstallable(false);
            setDeferredPrompt(null);
            setIsInstalled(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) {
            return false; // 当前环境不支持自动触发 PWA 安装
        }
        // 触发安装提示
        deferredPrompt.prompt();
        // 等待用户选择
        const { outcome } = await deferredPrompt.userChoice;

        // 我们清空 deferredPrompt 以防它在此生命周期内再次被使用（通常只能弹一次）
        setDeferredPrompt(null);

        if (outcome === 'accepted') {
            setIsInstallable(false);
            return true;
        }

        return false;
    }, [deferredPrompt]);

    return { isInstallable, isInstalled, isIOS, install };
}
