import { EmbeddedTweet, type TweetComponents, TweetNotFound, TweetSkeleton } from "react-tweet"
import { useTweet } from "react-tweet"

import type { QuotedTweet, Tweet, TweetEntities } from "react-tweet/api"

/**
 * The Twitter syndication API now returns `"entities": {}` (empty object)
 * for tweets without hashtags/mentions/urls/symbols. react-tweet v3.3.0's
 * `addEntities()` does `for (const entity of entities)` on these undefined
 * sub-arrays, crashing with "entities is not iterable".
 *
 * This wrapper normalizes the tweet (and its quoted_tweet) before handing
 * it to `EmbeddedTweet`.
 */

function normalizeEntities(entities: unknown): TweetEntities {
  if (!entities || typeof entities !== "object" || Array.isArray(entities)) {
    return { hashtags: [], user_mentions: [], urls: [], symbols: [] }
  }
  const e = entities as Partial<TweetEntities>
  return {
    ...e,
    hashtags: e.hashtags ?? [],
    user_mentions: e.user_mentions ?? [],
    urls: e.urls ?? [],
    symbols: e.symbols ?? [],
  }
}

function normalizeQuotedTweet(tweet: QuotedTweet): QuotedTweet {
  return {
    ...tweet,
    entities: normalizeEntities(tweet.entities),
  }
}

function normalizeTweet(tweet: Tweet): Tweet {
  if (!tweet.quoted_tweet) {
    return {
      ...tweet,
      entities: normalizeEntities(tweet.entities),
    }
  }

  return {
    ...tweet,
    entities: normalizeEntities(tweet.entities),
    quoted_tweet: normalizeQuotedTweet(tweet.quoted_tweet),
  }
}

export function SafeTweet({ id, components }: { id: string; components?: TweetComponents }) {
  const { data, error, isLoading } = useTweet(id)

  if (isLoading) return <TweetSkeleton />
  if (error || !data) {
    const NotFound = components?.TweetNotFound ?? TweetNotFound
    return <NotFound error={error} />
  }

  return <EmbeddedTweet tweet={normalizeTweet(data)} components={components} />
}
