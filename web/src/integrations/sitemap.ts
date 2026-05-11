import { type Sitemap } from "tanstack-router-sitemap"

import type { FileRouteTypes } from "@/routeTree.gen"

type TRoutes = FileRouteTypes["fullPaths"]

const FALLBACK_BASE_URL = "https://dokumenai.dev"

function getSiteUrl() {
  const baseUrl = process.env.BASE_URL || FALLBACK_BASE_URL
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

export const sitemap: Sitemap<TRoutes> = {
  siteUrl: getSiteUrl(),
  defaultPriority: 0.5,
  defaultChangeFreq: "weekly",
  routes: {
    "/": {
      priority: 1,
      changeFrequency: "daily",
    },
    "/demo": {
      priority: 0.8,
      changeFrequency: "weekly",
    },
    "/platform": {
      priority: 0.7,
      changeFrequency: "weekly",
    },
    "/signin": {
      priority: 0.4,
      changeFrequency: "monthly",
    },
    "/signup": {
      priority: 0.5,
      changeFrequency: "weekly",
    },
  },
}
