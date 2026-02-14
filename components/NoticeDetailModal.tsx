import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Share2,
  X,
} from 'lucide-react';
import { Article } from '../types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getTimeWindowState, formatTimestamp } from '@/lib/time-window';
import { CountdownBar } from './CountdownBar';
import jxnuLogo from '../content/img/JXNUlogo.png';
import { renderSimpleMarkdown } from '../lib/simple-markdown';

interface NoticeDetailModalProps {
  article: Article | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  shareUrl: string;
}

export const NoticeDetailModal: React.FC<NoticeDetailModalProps> = React.memo(({
  article,
  onClose,
  onPrev,
  onNext,
  canPrev,
  canNext,
  shareUrl,
}) => {
  const { toast } = useToast();
  const [badgeSrc, setBadgeSrc] = React.useState(jxnuLogo);
  const [nowTs, setNowTs] = React.useState(() => Date.now());
  const openedAtRef = React.useRef(0);
  const modalBodyRef = React.useRef<HTMLDivElement | null>(null);
  const isCoarsePointer = React.useMemo(() => {
    if (!window.matchMedia) return false;
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }, []);

  React.useEffect(() => {
    if (!article) return;
    openedAtRef.current = Date.now();
    setNowTs(Date.now());

    const end = article.endAt ? new Date(article.endAt).getTime() : Number.NaN;
    const needsLiveTimer = Number.isFinite(end) && Date.now() < end;
    if (!needsLiveTimer) return;
    if (isCoarsePointer) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [article, isCoarsePointer]);

  const handleOverlayClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  }, [onClose]);

  const timing = React.useMemo(() => getTimeWindowState(article?.startAt, article?.endAt, nowTs), [article?.startAt, article?.endAt, nowTs]);

  React.useEffect(() => {
    if (!article) return;
    setBadgeSrc(article.badge || jxnuLogo);
  }, [article]);
  const iconForAttachment = (type?: string, name?: string) => {
    const ext = (type || name?.split('.').pop() || 'file').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return FileVideo;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return FileAudio;
    return FileText;
  };

  React.useEffect(() => {
    if (!article) return undefined;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && canPrev) onPrev();
      if (event.key === 'ArrowRight' && canNext) onNext();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [article, onClose, onPrev, onNext, canPrev, canNext]);

  const handleShare = async () => {
    if (!article) return;
    const rawUrl = shareUrl || `${window.location.origin}${window.location.pathname}#${article.guid}`;
    const targetUrl = (() => {
      try {
        const parsed = new URL(rawUrl, window.location.origin);
        const encodedPath = parsed.pathname
          .split('/')
          .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
          .join('/');
        const encodedHash = parsed.hash
          ? `#${encodeURIComponent(decodeURIComponent(parsed.hash.slice(1)))}`
          : '';
        return `${parsed.origin}${encodedPath}${parsed.search}${encodedHash}`;
      } catch {
        return encodeURI(rawUrl);
      }
    })();

    const fallbackCopy = (text: string): boolean => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
        toast({ description: '复制链接成功' });
        return;
      }
    } catch {
      // Continue to fallback.
    }

    if (fallbackCopy(targetUrl)) {
      toast({ description: '复制链接成功' });
      return;
    }

    window.prompt('复制此链接', targetUrl);
    toast({ description: '无法自动复制，请手动复制链接', variant: 'destructive' });
  };

  const descriptionHtml = React.useMemo(
    () => DOMPurify.sanitize(renderSimpleMarkdown(article?.description || '')),
    [article?.description]
  );

  const sanitizedContent = React.useMemo(
    () => (article?.content ? DOMPurify.sanitize(article.content) : ''),
    [article?.content]
  );
  const sourceChannelText = String(article?.source?.channel || article?.feedTitle || '未知群号').trim() || '未知群号';
  const sourceSenderText = String(article?.source?.sender || article?.author || '未知发布人').trim() || '未知发布人';

  const navButtons = (
    <>
      <Button variant="outline" size="icon" onClick={onPrev} disabled={!canPrev} className="h-10 w-10">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onNext} disabled={!canNext} className="h-10 w-10">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </>
  );

  const dateDisplay = article ? (
    <div className="inline-flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      <Calendar className="h-4 w-4 shrink-0" />
      <span className="truncate">{new Date(article.pubDate).toLocaleString('zh-CN')}</span>
    </div>
  ) : null;

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="ghost" className="gap-2 h-10 px-3" onClick={handleShare}>
        <Share2 className="h-4 w-4" /> 分享
      </Button>
      <Button onClick={onClose} className="h-10 px-4">关闭</Button>
    </div>
  );

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 md:backdrop-blur-sm p-4 md:p-8"
          onClick={handleOverlayClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="mx-auto h-full max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border bg-background shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full border bg-background overflow-hidden shrink-0">
                  <img
                    src={badgeSrc}
                    alt="院徽"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={() => setBadgeSrc(jxnuLogo)}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {article.author || '未知发布人'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {article.source?.channel || article.feedTitle || '通知来源'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <ScrollArea className="flex-1">
              <div
                ref={modalBodyRef}
                className="mx-auto w-full max-w-3xl min-w-0 overflow-x-auto p-5 md:p-8"
              >
                <div className="flex flex-wrap gap-2 mb-4">
                  {timing.state === 'active' && (
                    <div className="w-full mb-2">
                      <CountdownBar progress={timing.progress} endAt={article.endAt} nowTs={nowTs} size="md" />
                    </div>
                  )}
                  {timing.state === 'expired' && (
                    <span className="text-[11px] px-2 py-1 rounded border border-rose-300/80 bg-rose-50 text-rose-700 font-bold dark:border-rose-300/60 dark:bg-rose-500/20 dark:text-rose-100">已过期</span>
                  )}
                  {timing.state === 'upcoming' && (
                    <span className="text-[11px] px-2 py-1 rounded border border-sky-300/80 bg-sky-50 text-sky-700 font-bold dark:border-sky-300/60 dark:bg-sky-500/20 dark:text-sky-100">
                      将于 {formatTimestamp(article.startAt)} 开始
                    </span>
                  )}
                  {article.aiCategory && (
                    <span className="text-[11px] bg-primary text-primary-foreground px-2 py-1 rounded border border-primary/80 font-semibold">{article.aiCategory}</span>
                  )}
                  {(article.tags || []).filter((tag) => String(tag).trim() !== '学院通知').map((tag) => (
                    <span key={tag} className="text-[11px] bg-muted text-foreground px-2 py-1 rounded border">#{tag}</span>
                  ))}
                </div>

                <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4 break-words [overflow-wrap:anywhere]">{article.title}</h2>

                <div
                  className="text-base leading-relaxed text-muted-foreground mb-6 break-words [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />

                {article.attachments && article.attachments.length > 0 && (
                  <section className="mb-6 rounded-xl border bg-muted/20 p-4 overflow-x-auto">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">附件下载</h3>
                    <div className="space-y-2">
                      {article.attachments.map((attachment) => {
                        const Icon = iconForAttachment(attachment.type, attachment.name);
                        const hasLink = Boolean(attachment.url && attachment.url !== '#');
                        if (!hasLink) {
                          return (
                            <div
                              key={`${attachment.url}-${attachment.name}`}
                              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                            >
                              <div className="min-w-0 flex flex-1 items-center gap-2">
                                <Icon className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium break-all leading-snug">{attachment.name}</p>
                                  <p className="text-xs text-muted-foreground">{attachment.type || 'file'}</p>
                                </div>
                              </div>
                              <span className="inline-flex shrink-0 items-center gap-1 text-primary text-xs font-bold">
                                已记录 <Download className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          );
                        }

                        return (
                          <a
                            key={`${attachment.url}-${attachment.name}`}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:border-primary/50"
                          >
                            <div className="min-w-0 flex flex-1 items-center gap-2">
                              <Icon className="h-4 w-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium break-all leading-snug">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground">{attachment.type || 'file'}</p>
                              </div>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-primary text-xs font-bold">
                              下载 <Download className="h-3.5 w-3.5" />
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                )}

                <p className="mb-4 text-sm italic text-muted-foreground">以下为通知原文：</p>

                <article className="prose prose-slate max-w-none text-base leading-relaxed dark:prose-invert overflow-x-hidden prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-code:break-all prose-p:break-words prose-p:[overflow-wrap:anywhere] prose-li:break-words prose-li:[overflow-wrap:anywhere] prose-headings:break-words prose-headings:[overflow-wrap:anywhere] prose-a:break-all prose-img:max-w-full prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
                  <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                </article>

                <p className="mt-4 text-sm italic text-muted-foreground">{`————转发信息来源：${sourceChannelText}、发送者：${sourceSenderText}`}</p>

              </div>
            </ScrollArea>

            <footer className="px-4 py-3 md:px-6 border-t bg-background shrink-0">
              {/* Mobile: nav above, date + actions below */}
              <div className="flex items-center justify-center gap-2 lg:hidden mb-3">
                {navButtons}
              </div>
              <div className="flex items-center justify-between gap-3 lg:hidden">
                {dateDisplay}
                {actionButtons}
              </div>

              {/* Desktop: date | nav | actions in one row */}
              <div className="hidden lg:flex items-center justify-between gap-3">
                {dateDisplay}
                <div className="flex items-center gap-2">{navButtons}</div>
                {actionButtons}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

NoticeDetailModal.displayName = 'NoticeDetailModal';
