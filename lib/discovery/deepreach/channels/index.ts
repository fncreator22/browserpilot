/**
 * §DEEPREACH CHANNELS REGISTRY
 * Central index and factory for zero-fee multi-platform deep discovery adapters.
 */

export * from "./types";
export * from "./linkedInChannel";
export * from "./twitterChannel";
export * from "./redditChannel";
export * from "./youtubeChannel";

import { linkedInChannel } from "./linkedInChannel";
import { twitterChannel } from "./twitterChannel";
import { redditChannel } from "./redditChannel";
import { youtubeChannel } from "./youtubeChannel";
import type { DeepReachChannelAdapter } from "./types";

export const ALL_DEEPREACH_CHANNELS: DeepReachChannelAdapter[] = [
  linkedInChannel,
  twitterChannel,
  redditChannel,
  youtubeChannel,
];

export const DEEPREACH_CHANNEL_MAP: Record<string, DeepReachChannelAdapter> = {
  [linkedInChannel.id]: linkedInChannel,
  [twitterChannel.id]: twitterChannel,
  [redditChannel.id]: redditChannel,
  [youtubeChannel.id]: youtubeChannel,
  linkedin: linkedInChannel,
  twitter: twitterChannel,
  reddit: redditChannel,
  youtube: youtubeChannel,
};
