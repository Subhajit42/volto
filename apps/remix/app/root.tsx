import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useHref,
  useLocation,
  useNavigate,
} from '@remix-run/react';
import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import PloneClient from '@plone/client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import '@plone/components/dist/basic.css';
import { flattenToAppURL } from './utils';
import { PloneProvider } from '@plone/providers';
import config from '@plone/registry';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
];

function useHrefLocal(to) {
  return useHref(flattenToAppURL(to));
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  const [ploneClient] = useState(() =>
    PloneClient.initialize({
      apiPath: config.settings.apiPath,
    }),
  );

  const RRNavigate = useNavigate();

  const navigate = (to) => {
    return RRNavigate(flattenToAppURL(to));
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <PloneProvider
          ploneClient={ploneClient}
          queryClient={queryClient}
          useHref={useHrefLocal}
          useLocation={useLocation}
          navigate={navigate}
        >
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <ReactQueryDevtools initialIsOpen={false} />
        </PloneProvider>
      </body>
    </html>
  );
}
