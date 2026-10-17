import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <title>8Playo — Party Games with Friends</title>
      <meta name="description" content="Play quick party games with friends on 8Playo. Memory, timing, color and sound challenges, plus tools for your next get-together." />
      <meta name="application-name" content="8Playo" />
      <link rel="icon" type="image/png" href="/8playo-icon.png" />
      <link rel="apple-touch-icon" href="/8playo-icon.png" />
      <meta name="apple-mobile-web-app-title" content="8Playo" />
      <meta property="og:site_name" content="8Playo" />
      <meta property="og:title" content="8Playo — Party Games with Friends" />
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
