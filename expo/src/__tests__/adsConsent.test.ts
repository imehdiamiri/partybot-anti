import { AdsController, ConsentAdapter } from '../services/AdsController';
import { canRequestWebAds } from '../services/webAdsConsent';

function fixture(canRequestAds = true) {
  const adapter: ConsentAdapter = {
    gather: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue({ canRequestAds, privacyOptionsRequirementStatus: 'REQUIRED' }),
    privacy: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
  };
  return { adapter, controller: new AdsController(adapter) };
}
test('simultaneous placements gather and initialize once, after consent', async () => {
  const { adapter, controller } = fixture();
  expect(controller.snapshot().ready).toBe(false);
  await Promise.all([controller.start(), controller.start()]);
  expect(adapter.gather).toHaveBeenCalledTimes(1);
  expect(adapter.initialize).toHaveBeenCalledTimes(1);
  expect(controller.snapshot().ready).toBe(true);
});
test('denied/unknown consent does not initialize or request ads', async () => {
  const { adapter, controller } = fixture(false);
  await controller.start();
  expect(adapter.initialize).not.toHaveBeenCalled();
  expect(controller.snapshot().ready).toBe(false);
});
test('consent errors fail closed unless UMP supplies a valid cached decision', async () => {
  const { adapter, controller } = fixture(false);
  (adapter.gather as jest.Mock).mockRejectedValue(Error('offline'));
  await controller.start(); expect(controller.snapshot().ready).toBe(false);
  (adapter.info as jest.Mock).mockResolvedValue({ canRequestAds: true, privacyOptionsRequirementStatus: 'REQUIRED' });
  await controller.start(); expect(controller.snapshot().ready).toBe(true);
});
test('privacy revocation immediately removes ads and updates permission', async () => {
  const { adapter, controller } = fixture();
  await controller.start();
  (adapter.info as jest.Mock).mockResolvedValue({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' });
  const closing = controller.privacy();
  expect(controller.snapshot().ready).toBe(false);
  await closing; expect(controller.snapshot().ready).toBe(false);
});
test('an obsolete startup cannot re-enable ads over a privacy change', async () => {
  const { adapter, controller } = fixture(false);
  let resolve!: () => void;
  (adapter.gather as jest.Mock).mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  const startup = controller.start();
  await controller.privacy(); resolve(); await startup;
  expect(controller.snapshot().ready).toBe(false);
  expect(adapter.initialize).not.toHaveBeenCalled();
});
test('SDK failure leaves gameplay unblocked and can retry on next placement', async () => {
  const { adapter, controller } = fixture();
  (adapter.initialize as jest.Mock).mockRejectedValueOnce(Error('SDK unavailable'));
  await controller.start(); expect(controller.snapshot().ready).toBe(false);
  await controller.start(); expect(controller.snapshot().ready).toBe(true);
});

test('a newly mounted placement cannot interrupt an open privacy form', async () => {
  const { adapter, controller } = fixture();
  await controller.start();
  let close!: () => void;
  (adapter.privacy as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { close = resolve; }));
  const form = controller.privacy();
  const placement = controller.start();
  expect(controller.snapshot().ready).toBe(false);
  expect(adapter.gather).toHaveBeenCalledTimes(1);
  close(); await Promise.all([form, placement]);
  expect(adapter.privacy).toHaveBeenCalledTimes(1);
});
test('web ads require an affirmative, settled certified CMP response', () => {
  expect(canRequestWebAds({}, true)).toBe(false);
  expect(canRequestWebAds({ cmpStatus: 'loaded', eventStatus: 'tcloaded', gdprApplies: false }, true)).toBe(true);
  const data = { cmpStatus: 'loaded', eventStatus: 'useractioncomplete', gdprApplies: true,
    vendor: { consents: { 755: true } }, purpose: { consents: { 1: true, 2: true, 7: true, 9: true, 10: true } } };
  expect(canRequestWebAds(data, true)).toBe(true);
  expect(canRequestWebAds(data, false)).toBe(false);
  expect(canRequestWebAds({ ...data, eventStatus: 'cmpuishown' }, true)).toBe(false);
  expect(canRequestWebAds({ ...data, vendor: { consents: { 755: false } } }, true)).toBe(false);
});
