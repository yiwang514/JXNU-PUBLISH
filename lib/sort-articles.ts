import { Article } from '../types';
import { UNKNOWN_SCHOOL } from './constants';

/**
 * Unified article sort: pinned first, then newest pubDate, guid as tiebreaker.
 *
 * In all-schools view, only `schoolSlug === UNKNOWN_SCHOOL` pins are promoted
 * to the top — other schools' pins sort normally so they don't pile up.
 */
export const sortArticles = (articles: Article[], isAllSchoolsView: boolean): Article[] =>
  articles.slice().sort((a, b) => {
    const aPinned = isAllSchoolsView
      ? Boolean(a.pinned && a.schoolSlug === UNKNOWN_SCHOOL)
      : Boolean(a.pinned);
    const bPinned = isAllSchoolsView
      ? Boolean(b.pinned && b.schoolSlug === UNKNOWN_SCHOOL)
      : Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const diff = new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    if (diff !== 0) return diff;

    return (b.guid || '').localeCompare(a.guid || '', 'zh-CN');
  });
