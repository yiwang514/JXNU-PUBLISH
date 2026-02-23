import React from 'react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { useToast } from '@/hooks/use-toast';

const InstallIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24">
        <path fill="currentColor" d="M18 1.01L8 1c-1.1 0-2 .9-2 2v3h2V5h10v14H8v-1H6v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99M10 15h2V8H5v2h3.59L3 15.59L4.41 17L10 11.41z" />
    </svg>
);

export const InstallPWAButton: React.FC = () => {
    const { isInstallable, install, isIOS, isInstalled, diagnostics } = usePWAInstall();
    const { toast } = useToast();

    if (isInstalled) {
        return null;
    }

    const handleInstallClick = async () => {
        if (isInstallable) {
            const success = await install();
            if (!success) {
                toast({
                    title: "安装未完成",
                    description: "操作已取消或失败。",
                });
            }
        } else {
            if (isIOS) {
                toast({
                    title: "如何添加到主屏幕",
                    description: "请点击浏览器底部的「分享」图标，然后选择「添加到主屏幕」。",
                });
            } else {
                const debugCode = [
                    `SC:${diagnostics.secureContext ? 1 : 0}`,
                    `SW:${diagnostics.serviceWorkerSupported ? 1 : 0}`,
                    `SR:${diagnostics.serviceWorkerRegistered ? 1 : 0}`,
                    `ML:${diagnostics.manifestLinked ? 1 : 0}`,
                    `MR:${diagnostics.manifestReachable ? 1 : 0}`,
                ].join(' ');

                const reason = diagnostics.isLikelyInAppBrowser
                    ? '当前是应用内浏览器，请先用系统浏览器打开。'
                    : !diagnostics.secureContext
                        ? '当前不是 HTTPS 安全上下文。'
                        : !diagnostics.serviceWorkerSupported
                            ? '浏览器不支持 Service Worker。'
                            : !diagnostics.serviceWorkerRegistered
                                ? 'Service Worker 还未生效。'
                                : !diagnostics.manifestLinked || !diagnostics.manifestReachable
                                    ? 'manifest 暂不可用。'
                                    : '浏览器未触发自动安装事件。';

                toast({
                    title: "请改用菜单安装",
                    description: `${reason} 安卓请点右上角菜单，选择“安装应用/添加到主屏幕”。诊断: ${debugCode}`,
                });
            }
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleInstallClick}
            className="gap-1.5 h-8 text-xs font-semibold px-3"
            title="添加至手机"
        >
            添加至手机
            <InstallIcon className="w-4 h-4" />
        </Button>
    );
};
