import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { NotFound } from "../components/not-found"
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools"
import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent: NotFound,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1",
      },
      {
        title: "Dokumen AI",
      },
      {
        name: "description",
        content: "Web app for PDF entity labeling and recognition",
      },
      {
        property: "og:site_name",
        content: "Dokumen AI",
      },
      {
        property: "og:title",
        content: "Dokumen AI",
      },
      {
        property: "og:description",
        content: "Web app for PDF entity labeling and recognition",
      },
      {
        property: "og:image",
        content: (process.env.BASE_URL || "http://localhost:3000") + "/og.png",
      },
      {
        property: "og:url",
        content: process.env.BASE_URL || "http://localhost:3000", // avoid using import.meta.env.VITE_BASE_URL so it's SSR
      },
      {
        name: "twitter:title",
        content: "Dokumen AI",
      },
      {
        name: "twitter:description",
        content: "Web app for PDF entity labeling and recognition",
      },
      {
        name: "twitter:image",
        content: (process.env.BASE_URL || "http://localhost:3000") + "/og.png",
      },
      {
        name: "twitter:url",
        content: process.env.BASE_URL || "http://localhost:3000",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

import { getLocale } from "../paraglide/runtime"

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} className="bg-white text-black dark:bg-gray-950 dark:text-white">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-gray-50">
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
