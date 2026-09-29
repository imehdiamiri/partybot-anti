import React from 'react';
export function AdsPrivacyButton() {
  return <button type="button" style={{ minHeight: 48, padding: 16, color: '#BFD7F5', background: 'transparent', border: 0 }}
    onClick={() => {
      const fc = (window as any).googlefc;
      if (typeof fc?.showRevocationMessage === 'function') fc.showRevocationMessage();
      else window.alert('Advertising privacy choices are not available yet. Please check your connection and try again.');
    }}>Advertising privacy choices</button>;
}
