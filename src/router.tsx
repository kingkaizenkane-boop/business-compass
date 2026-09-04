import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { RouteErrorState, RouteNotFoundState } from "./components/business-os/route-error";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // A failed read is surfaced by the nearest route boundary rather than
        // rendering an empty page with no explanation.
        throwOnError: true,
        retry: 1,
        staleTime: 10_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Applies to every route that doesn't define its own, so an error stays
    // inside the app shell instead of replacing the whole screen.
    defaultErrorComponent: ({ error, reset }) => <RouteErrorState error={error} reset={reset} />,
    defaultNotFoundComponent: () => <RouteNotFoundState />,
  });

  return router;
};
