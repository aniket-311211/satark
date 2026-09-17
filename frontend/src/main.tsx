import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "@/components/satark/app-shell";
import { IdentityProvider } from "@/lib/identity";
import "./index.css";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

const page = (load: () => Promise<{ default: React.ComponentType }>) => () => load().then((m) => ({ Component: m.default }));

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, lazy: page(() => import("./pages/overview")) },
        { path: "queue", lazy: page(() => import("./pages/queue")) },
        { path: "cases/:id", lazy: page(() => import("./pages/case-file")) },
        { path: "customers", lazy: page(() => import("./pages/customers")) },
        { path: "customers/:id", lazy: page(() => import("./pages/customer-profile")) },
        { path: "lists", lazy: page(() => import("./pages/watchlists")) },
        { path: "news", lazy: page(() => import("./pages/news-desk")) },
        { path: "screen", lazy: page(() => import("./pages/screen")) },
        { path: "benchmark", lazy: page(() => import("./pages/benchmark")) },
        { path: "audit", lazy: page(() => import("./pages/audit")) },
        { path: "*", lazy: page(() => import("./pages/not-found")) },
      ],
    },
  ],
  { basename: "/app" },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </QueryClientProvider>
  </StrictMode>,
);
