import React from 'react';
import { Article, Feed } from '../types';

export function useArticleNavigation(
  filteredArticles: Article[],
  selectedFeed: Feed | null,
  markArticleRead: (guid: string) => void
) {
  const [activeArticle, setActiveArticle] = React.useState<Article | null>(null);

  const activeIndex = React.useMemo(() => {
    if (!activeArticle) return -1;
    return filteredArticles.findIndex((article) => article.guid === activeArticle.guid);
  }, [activeArticle, filteredArticles]);

  const syncHash = React.useCallback((articleId: string | null) => {
    const next = articleId ? `${window.location.pathname}#${articleId}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, []);

  const handleArticleSelect = React.useCallback((article: Article) => {
    markArticleRead(article.guid);
    setActiveArticle(article);
    syncHash(article.guid);
  }, [markArticleRead, syncHash]);

  const handlePrev = React.useCallback(() => {
    if (activeIndex <= 0) return;
    const nextArticle = filteredArticles[activeIndex - 1];
    setActiveArticle(nextArticle);
    syncHash(nextArticle.guid);
  }, [activeIndex, filteredArticles, syncHash]);

  const handleNext = React.useCallback(() => {
    if (activeIndex < 0 || activeIndex >= filteredArticles.length - 1) return;
    const nextArticle = filteredArticles[activeIndex + 1];
    setActiveArticle(nextArticle);
    syncHash(nextArticle.guid);
  }, [activeIndex, filteredArticles, syncHash]);

  const handleModalClose = React.useCallback(() => {
    setActiveArticle(null);
    syncHash(null);
  }, [syncHash]);

  // Restore article from URL hash on feed load
  React.useEffect(() => {
    if (!selectedFeed) return;
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!hash) return;
    const target = selectedFeed.items.find((item) => item.guid === hash);
    if (!target) return;

    markArticleRead(target.guid);
    setActiveArticle(target);
  }, [markArticleRead, selectedFeed]);

  return {
    activeArticle,
    activeIndex,
    handleArticleSelect,
    handlePrev,
    handleNext,
    handleModalClose,
  };
}
