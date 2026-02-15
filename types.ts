
export interface Enclosure {
  link: string;
  type: string;
}

export interface NoticeAttachment {
  name: string;
  url: string;
  type?: string;
}

export interface NoticeSource {
  channel?: string;
  sender?: string;
}

export enum ArticleCategory {
  NOTICE = '通知公告',
  COMPETITION = '竞赛相关',
  VOLUNTEER = '志愿实习',
  SECOND_CLASS = '二课活动',
  FORM = '问卷填表',
  OTHER = '其它分类',
}

export interface Article {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  schoolSlug?: string;
  schoolShortName?: string;
  thumbnail: string;
  description: string;
  content: string;
  enclosure: Enclosure;
  feedTitle?: string;
  aiCategory?: string;       // Stored classification
  tags?: string[];
  attachments?: NoticeAttachment[];
  source?: NoticeSource;
  badge?: string;
  startAt?: string;
  endAt?: string;
  pinned?: boolean;
  isPlaceholderCover?: boolean;
  subscriptionId?: string;
}

export interface Feed {
  url: string;
  title: string;
  description: string;
  image: string;
  items: Article[];
  category?: string;
}

// 订阅源配置元信息（不含文章内容，用于首屏快速渲染左侧列表）
export interface FeedMeta {
  id: string;
  category: string;
  feedType: 'global' | 'summary' | 'source';
  customTitle?: string;
  schoolSlug?: string;
  sourceChannel?: string;
  hiddenInSidebar?: boolean;
  routeSlug: string;
}

// --- 编译后数据类型 ---

export type ConclusionItem = {
  defaultMarkdown: string;
  defaultHtml: string;
  byDate: Record<string, { markdown: string; html: string }>;
};

export type CompiledContent = {
  generatedAt: string;
  updatedCount?: number;
  previousNoticeCount?: number;
  totalNotices?: number;
  schools: Array<{ slug: string; name: string; shortName?: string; icon?: string }>;
  subscriptions: Array<{
    id: string;
    schoolSlug: string;
    schoolName: string;
    title: string;
    number?: string;
    url: string;
    icon: string;
    enabled: boolean;
    order: number;
  }>;
  notices: Article[];
  conclusionBySchool: Record<string, ConclusionItem>;
};

export type SearchItem = {
  id: string;
  schoolSlug: string;
  subscriptionId?: string;
  title: string;
  description: string;
  contentPlainText: string;
};
