import React from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { FeedMeta, Feed, CompiledContent, SearchItem } from './types';
import { LeftSidebar } from './components/LeftSidebar';
import { ArticleList } from './components/ArticleList';
import { Dashboard } from './components/Dashboard';
import { NoticeDetailModal } from './components/NoticeDetailModal';
import { RightSidebar } from './components/RightSidebar';
import { useArticleFilters } from './hooks/use-article-filters';
import { useReadArticles } from './hooks/use-read-articles';
import { useFeedData } from './hooks/use-feed-data';
import { useArticleNavigation } from './hooks/use-article-navigation';

const useCompiledData = () => {
  const [contentData, setContentData] = React.useState<CompiledContent | null>(null);
  const [searchData, setSearchData] = React.useState<SearchItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [contentRes, searchRes] = await Promise.all([
          fetch('/generated/content-data.json'),
          fetch('/generated/search-index.json'),
        ]);
        if (!contentRes.ok) throw new Error(`加载 content-data 失败 (${contentRes.status})`);
        if (!searchRes.ok) throw new Error(`加载 search-index 失败 (${searchRes.status})`);

        const [contentJson, searchJson] = await Promise.all([
          contentRes.json() as Promise<CompiledContent>,
          searchRes.json() as Promise<SearchItem[]>,
        ]);

        if (!mounted) return;
        setContentData(contentJson);
        setSearchData(searchJson);
      } catch (e) {
        if (!mounted) return;
        const message = e instanceof Error ? e.message : '加载静态内容失败';
        setError(message);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return { contentData, searchData, error };
};

const AppShell: React.FC<{
  mode: 'list' | 'dashboard';
  contentData: CompiledContent;
  searchData: SearchItem[];
}> = ({ mode, contentData, searchData }) => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(window.innerWidth >= 1024);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = React.useState<boolean>(window.innerWidth >= 1024);
  const [loadingFeedId, setLoadingFeedId] = React.useState<string | null>(null);
  const articleListRef = React.useRef<HTMLDivElement>(null);

  const { readArticleIdsRef, markArticleRead } = useReadArticles();

  const {
    schoolFeedEntries, schoolShortNameMap, schoolNameBySlug,
    feedConfigs, getFeed, groupedFeeds, feedAvatarCache, feedSummaryMap,
  } = useFeedData(contentData);

  const feedContentCache = React.useMemo<Record<string, Feed>>(
    () => Object.fromEntries(schoolFeedEntries.map((e) => [e.meta.id, e.feed])),
    [schoolFeedEntries]
  );

  const selectedFeedMeta = React.useMemo(() => {
    const fallback = feedConfigs[0] || null;
    if (!slug) return fallback;
    return feedConfigs.find((meta) => meta.id === slug)
      || feedConfigs.find((meta) => meta.routeSlug === slug && meta.feedType === 'summary')
      || feedConfigs.find((meta) => meta.routeSlug === slug)
      || fallback;
  }, [feedConfigs, slug]);

  const selectedFeed = selectedFeedMeta ? getFeed(selectedFeedMeta.id) || null : null;
  const isAllSchoolsView = selectedFeedMeta?.id === 'all-schools';

  const {
    selectedDate, setSelectedDate,
    activeFilters, setActiveFilters,
    activeTagFilters, setActiveTagFilters,
    timedOnly, setTimedOnly,
    hideExpired, setHideExpired,
    currentPage, setCurrentPage,
    searchQuery, setSearchQuery,
    resetFilters, updateFilter,
    filteredArticles, paginatedArticles,
    tagStats, totalPages, visiblePageTokens,
    articleCountByDate,
  } = useArticleFilters(selectedFeed, searchData, isAllSchoolsView);

  const {
    activeArticle, activeIndex,
    handleArticleSelect, handlePrev, handleNext, handleModalClose,
  } = useArticleNavigation(filteredArticles, selectedFeed, markArticleRead);

  const handleFeedSelect = React.useCallback((meta: FeedMeta) => {
    const isReselectingCurrent = selectedFeedMeta?.id === meta.id;
    setLoadingFeedId(meta.id);
    setTimeout(() => {
      setLoadingFeedId(null);
      resetFilters();
      if (isReselectingCurrent) {
        navigate('/');
        return;
      }
      navigate(`/school/${meta.routeSlug}`);
    }, 120);
  }, [navigate, resetFilters, selectedFeedMeta?.id]);

  const handleSchoolSummaryJump = React.useCallback((schoolSlug?: string) => {
    if (!schoolSlug) return;
    resetFilters();
    navigate(`/school/${schoolSlug}`);
  }, [navigate, resetFilters]);

  if (!selectedFeedMeta || !selectedFeed) return <Navigate to="/" replace />;

  return (
    <div className="flex h-[100dvh] bg-background font-sans text-foreground overflow-hidden relative transition-colors duration-300">
      <LeftSidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        handleBackToDashboard={() => navigate('/dashboard')}
        errorMsg={null}
        groupedFeeds={groupedFeeds}
        feedContentCache={feedContentCache}
        feedSummaryMap={feedSummaryMap}
        feedAvatarCache={feedAvatarCache}
        selectedFeedMeta={mode === 'dashboard' ? null : selectedFeedMeta}
        loadingFeedId={loadingFeedId}
        handleFeedSelect={handleFeedSelect}
        loading={false}
        generatedAt={contentData.generatedAt}
        updatedCount={contentData.updatedCount ?? contentData.notices.length}
      />

      <main className="flex-1 flex flex-col h-full bg-background relative overflow-hidden min-w-0">
        <div className="flex-1 min-h-0 overflow-hidden">
          {mode === 'dashboard' ? (
            <Dashboard
              feedEntries={schoolFeedEntries}
              schoolShortNameMap={schoolShortNameMap}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              onBackToDashboard={() => navigate('/')}
            />
          ) : (
            <ArticleList
              selectedFeed={selectedFeed}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              selectedDate={selectedDate}
              isRightSidebarOpen={isRightSidebarOpen}
              setIsRightSidebarOpen={setIsRightSidebarOpen}
              activeFilters={activeFilters}
              activeTagFilters={activeTagFilters}
              handleFilterToggle={(value) => {
                if (value === '__reset__') {
                  updateFilter(setActiveFilters, []);
                  setActiveTagFilters([]);
                  return;
                }
                updateFilter(setActiveFilters, (prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
              }}
              onCategorySelect={(category) => {
                updateFilter(setActiveFilters, (prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]));
              }}
              onTagSelect={(tag) => {
                updateFilter(setActiveTagFilters, (prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
              }}
              searchQuery={searchQuery}
              onSearchQueryChange={(value) => {
                updateFilter(setSearchQuery, value);
              }}
              onResetFilters={resetFilters}
              paginatedArticlesWithCategory={paginatedArticles}
              readArticleIds={readArticleIdsRef.current}
              handleArticleSelect={handleArticleSelect}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              filteredArticlesCount={filteredArticles.length}
              articleListRef={articleListRef}
              visiblePageTokens={visiblePageTokens}
              feedId={selectedFeedMeta.id}
              loadedCount={selectedFeed.items.length}
              totalCount={selectedFeed.items.length}
              isAllSchoolsView={isAllSchoolsView}
              onSchoolSummaryJump={handleSchoolSummaryJump}
            />
          )}
        </div>
      </main>

      <RightSidebar
        isOpen={isRightSidebarOpen}
        onClose={() => setIsRightSidebarOpen(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          updateFilter(setActiveTagFilters, []);
          if (date) setIsRightSidebarOpen(true);
        }}
        articleCountByDate={articleCountByDate}
        timedOnly={timedOnly}
        onTimedOnlyChange={setTimedOnly}
        hideExpired={hideExpired}
        onHideExpiredChange={setHideExpired}
        tagStats={tagStats}
        activeTagFilters={activeTagFilters}
        onTagToggle={(tag) => {
          updateFilter(setActiveTagFilters, (prev: string[]) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
        }}
        selectedSchoolSlug={selectedFeedMeta?.schoolSlug || selectedFeedMeta?.id || null}
        conclusionBySchool={contentData.conclusionBySchool}
        schoolNameBySlug={schoolNameBySlug}
        selectedFeedId={selectedFeedMeta?.id || null}
      />

      <NoticeDetailModal
        article={activeArticle}
        onClose={handleModalClose}
        onPrev={handlePrev}
        onNext={handleNext}
        canPrev={activeIndex > 0}
        canNext={activeIndex >= 0 && activeIndex < filteredArticles.length - 1}
        shareUrl={
          activeArticle && selectedFeedMeta
            ? `${window.location.origin}/school/${
                selectedFeedMeta.id === 'all-schools'
                  ? (activeArticle.schoolSlug || selectedFeedMeta.routeSlug)
                  : selectedFeedMeta.routeSlug
              }#${activeArticle.guid}`
            : ''
        }
      />
    </div>
  );
};

const App: React.FC = () => {
  const { contentData, searchData, error } = useCompiledData();

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <h1 className="text-xl font-black">内容加载失败</h1>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  if (!contentData) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground font-semibold">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>载入中</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<AppShell mode="list" contentData={contentData} searchData={searchData} />} />
      <Route path="/school/:slug" element={<AppShell mode="list" contentData={contentData} searchData={searchData} />} />
      <Route path="/dashboard" element={<AppShell mode="dashboard" contentData={contentData} searchData={searchData} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
