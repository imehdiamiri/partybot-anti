const TTL = { waiting: 30 * 60 * 1000, playing: 6 * 60 * 60 * 1000, closed: 5 * 60 * 1000 };

function expired(room, now) {
  if (!room || typeof room !== 'object') return false;
  const last = Math.max(...[room.lastActivityAt, room.createdAt, room.gameState?.lastUpdatedAt]
    .map(value => typeof value === 'number' && Number.isFinite(value) ? value : 0));
  if (last <= 0 && room.status !== 'closed') return false;
  return now - last > (TTL[room.status] || TTL.waiting);
}

async function sweepStaleRoomsLogic(db, now = Date.now(), { pageSize = 100, maxPages = 5 } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 5) throw new Error('Invalid sweep bounds');
  const rooms = db.ref('rooms');
  const cursorRef = db.ref('metrics/roomSweeperCursor');
  let cursor = (await cursorRef.get()).val();
  let removed = 0;
  let scanned = 0;
  for (let page = 0; page < maxPages; page++) {
    let query = rooms.orderByKey();
    if (typeof cursor === 'string') query = query.startAfter(cursor);
    const snapshot = await query.limitToFirst(pageSize).once('value');
    const entries = [];
    snapshot.forEach(child => { entries.push(child); });
    for (const child of entries) {
      scanned++;
      if (!expired(child.val(), now)) continue;
      // The query is only a candidate list. Re-check server state atomically:
      // resumed activity/status changes must survive an earlier stale snapshot.
      let deleted = false;
      const result = await child.ref.transaction(room => {
        deleted = expired(room, now);
        // The first callback may see an empty SDK cache. Returning its value
        // forces server hash validation; undefined would abort before retrying.
        return deleted ? null : room;
      }, undefined, false);
      if (result.committed && deleted) removed++;
    }
    cursor = entries.length === pageSize ? entries[entries.length - 1].key : null;
    // Persist only after the page finishes. A crash replays a bounded page;
    // deleted rooms and transaction revalidation make replay safe.
    await cursorRef.set(cursor);
    if (cursor === null) break;
  }
  const day = new Date(now).toISOString().slice(0, 10);
  await db.ref(`metrics/sweeper/${day}`).transaction(value => {
    const metric = value || {};
    return { ...metric, runs: (metric.runs || 0) + 1, removed: (metric.removed || 0) + removed,
      scanned: (metric.scanned || 0) + scanned, lastRunAt: now };
  });
  console.log(`sweepStaleRooms: scanned ${scanned}, removed ${removed}.`);
  return { removed, scanned };
}

module.exports = { sweepStaleRoomsLogic };
