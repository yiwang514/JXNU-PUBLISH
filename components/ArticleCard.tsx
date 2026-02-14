import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Article, ArticleCategory } from '../types';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Calendar, ExternalLink, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTimeWindowState, formatTimestamp } from "@/lib/time-window";
import { CountdownBar } from './CountdownBar';
import jxnuLogo from '../content/img/JXNUlogo.png';
import { renderHighlightedText, renderSimpleMarkdown } from '../lib/simple-markdown';
import { getResponsiveCoverAttrs } from '../services/responsiveImage';
import { useNow } from '../hooks/use-now';

interface ArticleCardProps {
  article: Article;
  onClick: () => void;
  isSelected: boolean;
  isRead: boolean;
  onCategoryClick?: (category: string) => void;
  onTagClick?: (tag: string) => void;
  activeCategoryFilters?: string[];
  activeTagFilters?: string[];
  searchQuery?: string;
  priorityImage?: boolean;
  showSchoolTag?: boolean;
  onSchoolTagClick?: (schoolSlug?: string) => void;
  isAllSchoolsView?: boolean;
}

export const ArticleCard: React.FC<ArticleCardProps> = React.memo(({
  article,
  onClick,
  isSelected,
  isRead,
  onCategoryClick,
  onTagClick,
  activeCategoryFilters = [],
  activeTagFilters = [],
  searchQuery = '',
  priorityImage = false,
  showSchoolTag = false,
  onSchoolTagClick,
  isAllSchoolsView = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const thumbnailUrl = article.thumbnail || '';
  const isPlaceholderCover = Boolean(article.isPlaceholderCover);
  const hasValidThumbnail = !imgError && Boolean(article.thumbnail);
  const compactLogoMode = isPlaceholderCover || /\/img\/schoolicon\//.test(thumbnailUrl) || /\/JXNUlogo\.png$/.test(thumbnailUrl);
  const showFullCover = hasValidThumbnail && !compactLogoMode;
  const placeholderCover = thumbnailUrl || jxnuLogo;
  const responsiveCover = useMemo(() => getResponsiveCoverAttrs(thumbnailUrl), [thumbnailUrl]);

  const preview = useMemo(() => {
    const previewLength = hasValidThumbnail ? 150 : 700;
    const rawPreview = (article.description || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/br>/gi, '\n')
      .replace(/<(?!\/?br\b)[^>]+>/gi, '');
    return rawPreview.length > previewLength
      ? rawPreview.substring(0, previewLength).replace(/\s+\S*$/, '') + '...'
      : rawPreview || '无可用预览。';
  }, [article.description, hasValidThumbnail]);

  const previewHtml = useMemo(() => renderSimpleMarkdown(preview, searchQuery), [preview, searchQuery]);
  const titleHtml = useMemo(() => renderHighlightedText(article.title, searchQuery), [article.title, searchQuery]);

  const formattedDateTime = useMemo(() => {
    return new Date(article.pubDate).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(',', '');
  }, [article.pubDate]);

  const isRetweet = useMemo(() => {
    return /^RT\s/i.test(article.title) || /^Re\s/i.test(article.title);
  }, [article.title]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  }, [onClick]);

  const noticeTags = useMemo(() => {
    if (!Array.isArray(article.tags)) return [];
    return article.tags
      .filter((tag) => {
        const clean = String(tag).trim();
        return clean.length > 0 && clean !== '学院通知';
      })
      .slice(0, 4);
  }, [article.tags]);

  const primaryCategory = useMemo(() => {
    if (article.aiCategory) return article.aiCategory;
    return ArticleCategory.OTHER;
  }, [article.aiCategory]);

  const isCategoryActive = activeCategoryFilters.includes(primaryCategory);

  const hasTimeWindow = Boolean(article.startAt && article.endAt);
  const nowTs = useNow(hasTimeWindow, 1000);

  const timing = useMemo(() => getTimeWindowState(article.startAt, article.endAt, nowTs), [article.startAt, article.endAt, nowTs]);

  const pinnedLabel = useMemo(() => {
    if (!article.pinned) return '';
    if (isAllSchoolsView && article.schoolSlug && article.schoolSlug !== 'unknown') {
      const shortName = String(article.schoolShortName || article.feedTitle || '').trim();
      return `${shortName || '该院'}置顶`;
    }
    return '置顶';
  }, [article.feedTitle, article.pinned, article.schoolShortName, article.schoolSlug, isAllSchoolsView]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
        <Card
          asChild
          className={cn(
          "mobile-card-surface flex flex-col h-full min-h-[430px] overflow-hidden group transition-all duration-300 md:hover:shadow-md text-left w-full p-0",
          isSelected ? "ring-2 ring-primary border-primary" : "md:hover:border-primary/50"
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          aria-label={`阅读文章: ${article.title}`}
          className="relative flex flex-col h-full w-full cursor-pointer touch-manipulation"
        >
          <div className="relative aspect-video overflow-hidden w-full bg-muted/40">
            {showFullCover ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  loading={priorityImage ? 'eager' : 'lazy'}
                  fetchPriority={priorityImage ? 'high' : 'auto'}
                  decoding="async"
                  srcSet={responsiveCover.srcSet}
                  sizes={responsiveCover.sizes}
                  className="w-full h-full object-cover transition-transform duration-500 md:group-hover:scale-105"
                  onError={() => setImgError(true)}
                />
            ) : (imgError && Boolean(article.thumbnail)) ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/20 text-muted-foreground">
                <ImageOff className="w-8 h-8" aria-hidden="true" />
                <span className="text-xs font-medium">封面加载失败</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-muted/20 to-muted/40">
                <img
                  src={placeholderCover}
                  alt="默认院徽占位"
                  loading={priorityImage ? 'eager' : 'lazy'}
                  fetchPriority={priorityImage ? 'high' : 'auto'}
                  className="w-24 h-24 object-contain opacity-85 transition-transform duration-500 md:group-hover:scale-110"
                />
              </div>
            )}
          </div>

          <div className="absolute top-2 left-2 z-20 flex flex-wrap gap-1 items-start max-w-[90%]">
            {showSchoolTag && article.feedTitle && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSchoolTagClick?.(article.schoolSlug);
                }}
                className="inline-flex items-center rounded text-[11px] px-2.5 py-0.5 font-semibold border border-sky-600/70 bg-sky-600 text-white hover:bg-sky-700 transition-colors"
              >
                {article.feedTitle}
              </button>
            )}
            {article.pinned && (
              <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 border border-amber-300 text-[11px] px-2 py-0.5 font-semibold">
                {pinnedLabel}
              </span>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCategoryClick?.(primaryCategory);
              }}
              className={cn(
                'inline-flex items-center rounded text-[12px] px-2.5 py-0.5 font-semibold border transition-colors',
                isCategoryActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-primary text-primary-foreground border-primary/80 hover:bg-primary/90'
              )}
            >
              {primaryCategory}
            </button>
            {isRetweet && (
              <span className="inline-flex items-center rounded bg-secondary text-secondary-foreground text-[11px] px-1.9 py-0.5 font-semibold">
                RT
              </span>
            )}
            {noticeTags
              .filter((tag) => tag !== primaryCategory)
              .map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={(event) => {
                    event.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className={cn(
                    'inline-flex items-center rounded border backdrop-blur-sm text-[12px] px-2.5 py-0.5 font-medium transition-colors',
                    activeTagFilters.includes(tag)
                      ? 'bg-foreground/15 text-foreground border-foreground/25'
                      : 'bg-background/85 hover:bg-muted hover:border-foreground/25'
                  )}
                >
                  #{tag}
                </button>
              ))}
          </div>
          
          {!isRead && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
          )}

        <CardHeader className="p-4 pb-2 space-y-1">
          <h3
            className="font-bold text-xl leading-tight line-clamp-2 md:group-hover:text-primary transition-colors [&_mark]:rounded-sm [&_mark]:bg-amber-200/80 [&_mark]:text-foreground [&_mark]:px-0.5"
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />
        </CardHeader>
        
        <CardContent className="p-4 pt-0 flex-1">
          <div
            className={cn(
              "text-sm text-muted-foreground leading-relaxed [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_mark]:rounded-sm [&_mark]:bg-amber-200/80 [&_mark]:text-foreground [&_mark]:px-0.5",
              hasValidThumbnail ? "line-clamp-3" : "line-clamp-7"
            )}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </CardContent>
        
        <CardFooter className={cn('px-4 border-t border-border/50 mt-auto', timing.state === 'active' ? 'py-2' : 'h-12 py-0', timing.state !== 'active' && 'flex items-center justify-between')}>
          {timing.state === 'active' ? (
            <CountdownBar progress={timing.progress} endAt={article.endAt} nowTs={nowTs} size="sm" />
          ) : (
            <>
              <div className="flex items-center gap-2 text-[13px] leading-none text-muted-foreground font-medium">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <time className="leading-none">{formattedDateTime}</time>
              </div>
              {timing.state === 'upcoming' ? (
                <span className="text-[10px] px-2 py-0.5 rounded border border-sky-300/80 bg-sky-50 text-sky-700 font-bold dark:border-sky-300/60 dark:bg-sky-500/20 dark:text-sky-100">
                  将于 {formatTimestamp(article.startAt)} 开始
                </span>
              ) : timing.state === 'expired' ? (
                <span className="text-[10px] px-2 py-0.5 rounded border border-rose-300/80 bg-rose-50 text-rose-700 font-bold dark:border-rose-300/60 dark:bg-rose-500/20 dark:text-rose-100">已过期</span>
              ) : (
                <div className="flex items-center gap-1 text-primary font-bold text-[10px] uppercase tracking-tight opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all transform translate-x-0 md:translate-x-2 md:group-hover:translate-x-0">
                  <span>阅读全文</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              )}
            </>
          )}
         </CardFooter>
         </div>
      </Card>
    </motion.div>
  );
});
