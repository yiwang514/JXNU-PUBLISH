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
    const { isInstallable, install, isIOS, isInstalled } = usePWAInstall();
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
                toast({
                    title: "当前浏览器不支持自动安装",
                    description: "请点击浏览器菜单中的「添加到主屏幕」或「安装应用」来完成操作。",
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
