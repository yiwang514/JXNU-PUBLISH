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
            } else if (diagnostics.isLikelyInAppBrowser) {
                toast({
                    title: "当前是内置浏览器",
                    description: "请先在系统浏览器打开（Chrome/Edge），内置浏览器通常不支持安装提示。",
                });
            } else if (!diagnostics.secureContext) {
                toast({
                    title: "当前不是安全上下文",
                    description: "添加到主屏幕要求 HTTPS（或 localhost）。请先用 https 访问。",
                });
            } else if (!diagnostics.serviceWorkerSupported) {
                toast({
                    title: "浏览器不支持 Service Worker",
                    description: "该浏览器不满足 PWA 安装前置条件，请换 Chrome/Edge。",
                });
            } else if (!diagnostics.manifestLinked || !diagnostics.manifestReachable) {
                toast({
                    title: "站点清单读取失败",
                    description: "manifest.json 未正确加载，已回退到手动安装路径。",
                });
            } else if (!diagnostics.serviceWorkerRegistered) {
                toast({
                    title: "安装条件还在准备中",
                    description: "Service Worker 尚未生效，请刷新页面后再试一次。",
                });
            } else if (diagnostics.isAndroid && diagnostics.isChromeLike) {
                toast({
                    title: "浏览器未发出安装事件",
                    description: "请先浏览几秒再刷新，然后从菜单选择“安装应用/添加到主屏幕”。",
                });
            } else {
                const debugCode = [
                    `SC:${diagnostics.secureContext ? 1 : 0}`,
                    `SW:${diagnostics.serviceWorkerSupported ? 1 : 0}`,
                    `SR:${diagnostics.serviceWorkerRegistered ? 1 : 0}`,
                    `ML:${diagnostics.manifestLinked ? 1 : 0}`,
                    `MR:${diagnostics.manifestReachable ? 1 : 0}`,
                ].join(' ');

                toast({
                    title: "当前浏览器不支持自动安装",
                    description: `请改用菜单手动安装。诊断: ${debugCode}`,
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
