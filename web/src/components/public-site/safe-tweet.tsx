import { EmbeddedTweet, TweetNotFound, TweetSkeleton, type TweetComponents } from "react-tweet"
import { useTweet } from "react-tweet"

/**
 * Wrapper around react-tweet's <Tweet> that normalizes the entities object
 * before rendering. The library's addEntities() crashes with
 * "entities is not iterable" when the Twitter syndication API omits
 * hashtags/user_mentions/symbols from the response.
 */
export function SafeTweet({
  id,
  components,
}: {
  id: string
  components?: TweetComponents
}) {
  const { data, error, isLoading } = useTweet(id)

  if (isLoading) return <TweetSkeleton />
  if (error || !data) {
    const NotFound = components?.TweetNotFound ?? TweetNotFound
    return <NotFound error={error} />
  }

  // Normalize entities so addEntities() never receives undefined
  if (data.entities && typeof data.entities === "object" && !Array.isArray(data.entities)) {
    const e = data.entities as Record<string, unknown>
    if (!e.hashtags) e.hashtags = []
    if (!e.user_mentions) e.user_mentions = []
    if (!e.symbols) e.symbols = []
    if (!e.urls) e.urls = []
  }

  return <EmbeddedTweet tweet={data} components={components} />
}
