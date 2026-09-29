export type TCFData = {
  eventStatus?: string; cmpStatus?: string; gdprApplies?: boolean; listenerId?: number;
  purpose?: { consents?: Record<number, boolean>; legitimateInterests?: Record<number, boolean> };
  vendor?: { consents?: Record<number, boolean>; legitimateInterests?: Record<number, boolean> };
};
export function canRequestWebAds(data: TCFData, success: boolean): boolean {
  if (!success || data.cmpStatus !== 'loaded' ||
      !['tcloaded', 'useractioncomplete'].includes(data.eventStatus ?? '')) return false;
  if (data.gdprApplies === false) return true;
  // Conservative gate: no ads when the CMP cannot determine geography/consent.
  return data.gdprApplies === true && data.vendor?.consents?.[755] === true && data.purpose?.consents?.[1] === true &&
    [2, 7, 9, 10].every(purpose => data.purpose?.consents?.[purpose] === true ||
      (data.purpose?.legitimateInterests?.[purpose] === true && data.vendor?.legitimateInterests?.[755] === true));
}
