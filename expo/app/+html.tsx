import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="google-adsense-account" content="ca-pub-9376144248169220" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <ScrollViewStyleReset />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root { touch-action: pan-x pan-y !important; }
        html { -webkit-text-size-adjust: 100%; }
        input, textarea, select { font-size: max(16px, 1em) !important; }
      ` }} />
    </head>
    <body>{children}</body>
  </html>;
}
