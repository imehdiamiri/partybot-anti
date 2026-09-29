import React, { useEffect, useRef, useState } from 'react';
import { canRequestWebAds, TCFData } from '@/src/services/webAdsConsent';

const client = 'ca-pub-9376144248169220';
// A genuine AdSense web slot is required; native AdMob IDs are not interchangeable.
const slot = '1116184196';
type AdWindow = Window & {
  adsbygoogle?: Record<string, unknown>[];
  __tcfapi?: (command: string, version: number, callback: (data: TCFData, success: boolean) => void, id?: number) => void;
};
export function AdBanner() {
  const element = useRef<HTMLModElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const win = window as AdWindow;
    let active = true; let listener: number | undefined; let registered = false;
    // AdSense delivers the published Google CMP through its official tag.
    // Auto ads are disabled in the account; no placement is queued before consent.
    if (!document.getElementById('partybot-adsense')) {
      const script = document.createElement('script'); script.id = 'partybot-adsense'; script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      document.head.appendChild(script);
    }
    const register = () => {
      if (!win.__tcfapi || registered) return;
      registered = true;
      win.__tcfapi('addEventListener', 2, (data, success) => {
        listener = data?.listenerId;
        if (active) { setAllowed(canRequestWebAds(data ?? {}, success)); setFailed(false); }
        else if (listener !== undefined) win.__tcfapi?.('removeEventListener', 2, () => {}, listener);
      });
    };
    register();
    const interval = window.setInterval(register, 500);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 15000);
    return () => {
      active = false; window.clearInterval(interval); window.clearTimeout(timeout);
      if (listener !== undefined) win.__tcfapi?.('removeEventListener', 2, () => {}, listener);
    };
  }, []);
  useEffect(() => {
    if (!allowed || failed || !element.current) return;
    const target = element.current;
    let active = true;
    const request = () => {
      if (!active || target.dataset.adsbygoogleStatus) return;
      try { ((window as AdWindow).adsbygoogle ??= []).push({}); } catch { setFailed(true); }
    };
    let script = document.getElementById('partybot-adsense') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script'); script.id = 'partybot-adsense'; script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      document.head.appendChild(script);
    }
    // adsbygoogle queue works before or after the official script has loaded.
    request();
    const onError = () => setFailed(true);
    script.addEventListener('error', onError);
    const observer = new MutationObserver(() => {
      if (target.dataset.adStatus === 'unfilled') setFailed(true);
    });
    observer.observe(target, { attributes: true, attributeFilter: ['data-ad-status'] });
    const timeout = window.setTimeout(() => {
      if (target.dataset.adStatus !== 'filled') setFailed(true);
    }, 20000);
    return () => { active = false; window.clearTimeout(timeout); observer.disconnect(); script?.removeEventListener('error', onError); };
  }, [allowed, failed]);
  if (!allowed || failed) return null;
  return <div style={{ width: '100%', margin: '24px 0', minHeight: 100, textAlign: 'center' }} data-testid="ad-banner">
    <div style={{ color: '#9DA8B8', fontSize: 11, marginBottom: 8 }}>Advertisement</div>
    <ins ref={element} className="adsbygoogle" style={{ display: 'block', width: '100%', height: 90 }}
      data-ad-client={client} data-ad-slot={slot} data-ad-format="horizontal" data-full-width-responsive="true" />
  </div>;
}
