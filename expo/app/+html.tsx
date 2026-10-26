import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="description" content="Play quick party games with friends on 8Playo. Memory, timing, color and sound challenges, plus tools for your next get-together." />
      <meta name="application-name" content="8Playo" />
      <meta name="theme-color" content="#08080F" />
      <meta name="color-scheme" content="dark" />
      <link rel="icon" type="image/png" href="/8playo-icon.png" />
      <link rel="apple-touch-icon" href="/8playo-icon.png" />
      <meta name="apple-mobile-web-app-title" content="8Playo" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta property="og:site_name" content="8Playo" />
      <meta property="og:title" content="8Playo — Party Games with Friends" />
      <meta name="google-adsense-account" content="ca-pub-9376144248169220" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <ScrollViewStyleReset />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body, #root {
          touch-action: pan-x pan-y !important;
          background-color: #08080F;
          color-scheme: dark;
        }
        html { -webkit-text-size-adjust: 100%; }
        html, body { overscroll-behavior-y: none; }
        [data-testid="library-scroll"],
        [data-testid="tools-scroll"],
        [data-testid="friends-scroll"] { overscroll-behavior-y: contain; }
        [data-testid$="-profile-btn"]:focus-visible,
        [data-testid^="friends-segment-"]:focus-visible,
        [data-testid^="tab-library-"]:focus-visible {
          outline: 2px solid #64B5FF;
          outline-offset: 3px;
        }
        input, textarea, select { font-size: max(16px, 1em) !important; }
      ` }} />
    </head>
    <body>{children}</body>
  </html>;
}
