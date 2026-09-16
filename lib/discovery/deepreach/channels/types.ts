import type { 
  VerifiableJobCandidate, 
  VerifiableRecruiterContact 
} from "@/lib/verification/midwayVerifier";

export interface DeepReachChannelParams {
  companyName: string;
  roleTitle?: string;
  skills?: string[];
  companyDomain?: string;
  maxResults?: number;
  timeoutMs?: number;
  /**
   * Optional custom fetcher for testing with fixtures or specialized network transports.
   * If omitted, the default Jina Reader / native fetch is used.
   */
  fetcher?: (url: string, timeoutMs?: number) => Promise<string | null>;
}

export interface DeepReachChannelResult {
  channelName: string;
  sourcePlatform: string;
  jobs: VerifiableJobCandidate[];
  recruiters: VerifiableRecruiterContact[];
  sourceUrls: string[];
  error?: string;
}

export interface DeepReachChannelAdapter {
  id: string;
  name: string;
  sourcePlatform: string;
  description: string;
  scan: (params: DeepReachChannelParams) => Promise<DeepReachChannelResult>;
}

export interface DeepReachChannelsPreferences {
  linkedIn: boolean;
  twitter: boolean;
  reddit: boolean;
  youtube: boolean;
}

export const DEFAULT_DEEPREACH_CHANNELS: DeepReachChannelsPreferences = {
  linkedIn: true,
  twitter: true,
  reddit: true,
  youtube: true,
};
