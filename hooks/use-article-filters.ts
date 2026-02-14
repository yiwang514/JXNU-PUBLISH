import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Article, Feed, SearchItem } from '../types';
import { getTimeWindowState } from '../lib/time-window';
import { sortArticles } from '../lib/sort-articles';
import { useNow } from './use-now';

const ARTICLES_PER_PAGE = 12;

const getVisiblePageTokens = (currentPage: number, totalPages: number): (number | string)[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'e1', totalPages];
  if (currentPage >= totalPages - 3) return [1, 'e1', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, 'e1', currentPage - 1, currentPage, currentPage + 1, 'e2', totalPages];
};

export interface ArticleFilterState {
  selectedDate: Date | null;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | null>>;
  activeFilters: string[];
  setActiveFilters: React.Dispatch<React.SetStateAction<string[]>>;
  activeTagFilters: string[];
  setActiveTagFilters: React.Dispatch<React.SetStateAction<string[]>>;
  timedOnly: boolean;
  setTimedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  hideExpired: boolean;
  setHideExpired: React.Dispatch<React.SetStateAction<boolean>>;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  resetFilters: () => void;
  updateFilter: <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => void;
}

export function useArticleFilterState(): ArticleFilterState {
  const [searchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [activeFilters, setActiveFilters] = React.useState<string[]>([]);
  const [activeTagFilters, setActiveTagFilters] = React.useState<string[]>([]);
  const [timedOnly, setTimedOnly] = React.useState(false);
  const [hideExpired, setHideExpired] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(() => {
    const raw = searchParams.get('p');
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    return 1;
  });
  const [searchQuery, setSearchQuery] = React.useState('');

  const resetFilters = React.useCallback(() => {
    setSelectedDate(null);
    setCurrentPage(1);
    setSearchQuery('');
    setActiveFilters([]);
    setActiveTagFilters([]);
  }, []);

  const updateFilter = React.useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
    setCurrentPage(1);
    setter(value);
  }, []);

  return {
    selectedDate, setSelectedDate,
    activeFilters, setActiveFilters,
    activeTagFilters, setActiveTagFilters,
    timedOnly, setTimedOnly,
    hideExpired, setHideExpired,
    currentPage, setCurrentPage,
    searchQuery, setSearchQuery,
    resetFilters, updateFilter,
  };
}

export function useFilteredArticles(
  state: ArticleFilterState,
  selectedFeed: Feed | null,
  searchData: SearchItem[],
  isAllSchoolsView: boolean
) {
  const {
    selectedDate, activeFilters, activeTagFilters,
    timedOnly, hideExpired, currentPage, setCurrentPage,
    searchQuery,
  } = state;

  const [searchParams, setSearchParams] = useSearchParams();

  const nowTs = useNow(hideExpired || timedOnly, 30_000);

  const searchMatches = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    const set = new Set<string>();
    for (const row of searchData) {
      const source = `${row.title} ${row.description} ${row.contentPlainText}`.toLowerCase();
      if (source.includes(query)) set.add(row.id);
    }
    return set;
  }, [searchData, searchQuery]);

  const baseArticles = React.useMemo(() => {
    if (!selectedFeed) return [];
    if (!selectedDate) return selectedFeed.items;
    return selectedFeed.items.filter((item) => new Date(item.pubDate).toDateString() === selectedDate.toDateString());
  }, [selectedDate, selectedFeed]);

  const tagStats = React.useMemo(() => {
    const countMap = new Map<string, number>();
    for (const article of baseArticles) {
      for (const tag of article.tags || []) {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'));
  }, [baseArticles]);

  const matchesActiveCriteria = React.useCallback((article: Article) => {
    const timing = getTimeWindowState(article.startAt, article.endAt, nowTs);
    if (timedOnly && timing.state === 'none') return false;
    if (hideExpired && timing.state === 'expired') return false;
    if (searchMatches && !searchMatches.has(article.guid)) return false;
    if (activeFilters.length > 0 && !activeFilters.includes(article.aiCategory || '')) return false;
    if (activeTagFilters.length > 0) {
      const tags = article.tags || [];
      if (!activeTagFilters.every((tag) => tags.includes(tag))) return false;
    }
    return true;
  }, [activeFilters, activeTagFilters, hideExpired, nowTs, searchMatches, timedOnly]);

  const filteredArticles = React.useMemo(() => {
    return sortArticles(baseArticles.filter(matchesActiveCriteria), isAllSchoolsView);
  }, [baseArticles, isAllSchoolsView, matchesActiveCriteria]);

  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE));
  const visiblePageTokens = getVisiblePageTokens(currentPage, totalPages);
  const pageParam = searchParams.get('p');

  React.useEffect(() => {
    const parsed = Number(pageParam);
    const fromQuery = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    const normalized = Math.min(Math.max(fromQuery, 1), totalPages);
    setCurrentPage((prev) => (prev === normalized ? prev : normalized));
  }, [pageParam, setCurrentPage, totalPages]);

  React.useEffect(() => {
    const normalized = Math.min(Math.max(currentPage, 1), totalPages);
    const targetParam = normalized > 1 ? String(normalized) : null;
    if ((pageParam ?? null) === targetParam) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (targetParam) next.set('p', targetParam);
      else next.delete('p');
      return next;
    }, { replace: true });
  }, [currentPage, pageParam, setSearchParams, totalPages]);

  const paginatedArticles = React.useMemo(() => {
    const start = (currentPage - 1) * ARTICLES_PER_PAGE;
    return filteredArticles.slice(start, start + ARTICLES_PER_PAGE);
  }, [currentPage, filteredArticles]);

  const articleCountByDate = React.useMemo(() => {
    if (!selectedFeed) return null;
    const map: Record<string, number> = {};
    selectedFeed.items.filter(matchesActiveCriteria).forEach((article) => {
      const key = new Date(article.pubDate).toDateString();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [matchesActiveCriteria, selectedFeed]);

  return {
    filteredArticles,
    paginatedArticles,
    tagStats,
    totalPages,
    visiblePageTokens,
    articleCountByDate,
  };
}

/** Backward-compatible combined hook */
export function useArticleFilters(
  selectedFeed: Feed | null,
  searchData: SearchItem[],
  isAllSchoolsView: boolean
) {
  const filterState = useArticleFilterState();
  const filterResult = useFilteredArticles(filterState, selectedFeed, searchData, isAllSchoolsView);
  return { ...filterState, ...filterResult };
}
