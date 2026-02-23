import React from 'react';
import { Button } from '@/components/ui/button';

const InstallIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24">
        <path fill="currentColor" d="M18 1.01L8 1c-1.1 0-2 .9-2 2v3h2V5h10v14H8v-1H6v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99M10 15h2V8H5v2h3.59L3 15.59L4.41 17L10 11.41z" />
    </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24">
        <path fill="currentColor" d="M18.3 5.71 12 12l6.3 6.29-1.41 1.41L10.59 13.4 4.29 19.7 2.88 18.29 9.18 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z" />
    </svg>
);

export const InstallPWAButton: React.FC = () => {
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <>
        <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="gap-1.5 h-8 text-xs font-semibold px-3"
            title="添加至手机"
        >
            添加至手机
            <InstallIcon className="w-4 h-4" />
        </Button>

        {open && (
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
                <div
                    className="absolute left-1/2 top-1/2 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="添加到主屏幕教程"
                >
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <h3 className="text-sm font-bold">添加到主屏幕教程</h3>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="关闭教程"
                        >
                            <CloseIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto px-4 py-3 text-xs leading-relaxed text-foreground/90 space-y-3">
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="font-semibold">安卓（推荐 Chrome / Edge）</p>
                            <p>1) 用系统浏览器打开本站首页（不是微信/QQ内置浏览器）</p>
                            <p>2) 点击右上角菜单，优先选择“安装应用”</p>
                            <p>3) 若没有“安装应用”，再选择“添加到主屏幕”</p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="font-semibold">iPhone / iPad（Safari）</p>
                            <p>1) 在 Safari 打开本站</p>
                            <p>2) 点分享按钮</p>
                            <p>3) 选择“添加到主屏幕”</p>
                        </div>

                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-900 dark:text-amber-200">
                            <p className="font-semibold">图标缺失或不是全屏时</p>
                            <p>1) 删除旧桌面快捷方式后重新添加</p>
                            <p>2) 必须从“安装应用”入口安装，普通书签可能不是全屏</p>
                            <p>3) 确认访问的是 HTTPS 正式域名，不要用浏览器无痕模式</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
