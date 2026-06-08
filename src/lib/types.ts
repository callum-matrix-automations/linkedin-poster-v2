export interface UserProfile {
  name: string;
  title: string;
  industry: string;
  targetAudience: string;
  uniqueBackground: string;
  contrarian: string;
  personalStory: string;
  expertise: string;
  tone: string;
  completedOnboarding: boolean;
}

export interface LinkedInPost {
  type: string;
  id: string;
  linkedinUrl: string;
  content: string;
  author: {
    publicIdentifier: string | null;
    type: string;
    name: string;
    linkedinUrl: string;
    info: string;
    avatar: {
      url: string;
      width: number;
      height: number;
    } | null;
  };
  postedAt: {
    timestamp: number;
    date: string;
    postedAgoShort: string;
    postedAgoText: string;
  };
  engagement: {
    id: string;
    likes: number;
    comments: number;
    shares: number;
    reactions?: { type: string; count: number }[];
  };
  postImages: string[];
}

export interface SearchPostsRequest {
  searchQueries: string[];
  sortBy?: "relevance" | "date";
  postedLimit?: string;
  targetUrls?: string[];
  authorsPublicIdentifiers?: string[];
  authorsCompanyPublicIdentifiers?: string[];
}

export interface PostSuggestion {
  title: string;
  hook: string;
  angle: string;
  type: "personal" | "topical";
  inspirationPostId?: string;
}

export interface SavedDraft {
  id: string;
  suggestion: PostSuggestion;
  content: string;
  status: "drafting" | "finished";
  inspirationPosts: LinkedInPost[];
  createdAt: number;
  updatedAt: number;
}

export interface SavedSearch {
  queries: string[];
  posts: LinkedInPost[];
  searchedAt: number;
}

export const EMPTY_PROFILE: UserProfile = {
  name: "",
  title: "",
  industry: "",
  targetAudience: "",
  uniqueBackground: "",
  contrarian: "",
  personalStory: "",
  expertise: "",
  tone: "",
  completedOnboarding: false,
};
