import { EmbeddedTweet, TweetNotFound, TweetSkeleton, type TweetComponents } from "react-tweet"
import { useTweet } from "react-tweet"

/**
 * The Twitter syndication API now returns `"entities": {}` (empty object)
 * for tweets without hashtags/mentions/urls/symbols. react-tweet v3.3.0's
 * `addEntities()` does `for (const entity of entities)` on these undefined
 * sub-arrays, crashing with "entities is not iterable".
 *
 * This wrapper normalizes the tweet (and its quoted_tweet) before handing
 * it to `EmbeddedTweet`.
 */

type TweetEntities = {
  hashtags?: unknown[]
  user_mentions?: unknown[]
  urls?: unknown[]
  symbols?: unknown[]
  media?: unknown[]
}

function normalizeEntities(entities: unknown): TweetEntities {
  if (!entities || typeof entities !== "object" || Array.isArray(entities)) {
    return { hashtags: [], user_mentions: [], urls: [], symbols: [] }
  }
  const e = entities as TweetEntities
  return {
    ...e,
    hashtags: e.hashtags ?? [],
    user_mentions: e.user_mentions ?? [],
    urls: e.urls ?? [],
    symbols: e.symbols ?? [],
  }
}

function normalizeTweet(tweet: any): any {
  const normalized = {
    ...tweet,
    entities: normalizeEntities(tweet.entities),
  }

  if (tweet.quoted_tweet && typeof tweet.quoted_tweet === "object") {
    normalized.quoted_tweet = normalizeTweet(tweet.quoted_tweet)
  }

  return normalized
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
