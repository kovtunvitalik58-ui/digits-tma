import fs from 'node:fs';
import path from 'node:path';
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'db.json');
let cache = null;
let writeTimer = null;
function empty() {
    return { users: {}, friends: {}, results: {} };
}
/** Load once, cache in memory. Subsequent writes flush back to disk on a
 *  500 ms debounce so a burst of result + friend writes coalesce. */
export function load() {
    if (cache)
        return cache;
    try {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        cache = { ...empty(), ...parsed };
    }
    catch {
        cache = empty();
    }
    return cache;
}
export function save() {
    if (!cache)
        return;
    const snapshot = JSON.stringify(cache);
    if (writeTimer)
        clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
        try {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            // Atomic rewrite — write to tmp, then rename.
            const tmp = DB_PATH + '.tmp';
            fs.writeFileSync(tmp, snapshot);
            fs.renameSync(tmp, DB_PATH);
        }
        catch (err) {
            console.error('[db] failed to persist', err);
        }
    }, 500);
}
/** Idempotent — upserts user stamps and returns the record. */
export function touchUser(id, info) {
    const db = load();
    const key = String(id);
    const now = Date.now();
    const existing = db.users[key];
    const next = {
        id: key,
        firstName: info.firstName ?? existing?.firstName,
        lastName: info.lastName ?? existing?.lastName,
        username: info.username ?? existing?.username,
        photoUrl: info.photoUrl ?? existing?.photoUrl,
        languageCode: info.languageCode ?? existing?.languageCode,
        firstSeen: existing?.firstSeen ?? now,
        lastSeen: now,
    };
    db.users[key] = next;
    save();
    return next;
}
export function getUser(id) {
    return load().users[String(id)] ?? null;
}
/** Sum of stars across every recorded daily result for this user. */
export function totalStars(id) {
    const db = load();
    const key = String(id);
    let sum = 0;
    for (const day of Object.values(db.results)) {
        const r = day[key];
        if (r)
            sum += r.stars;
    }
    return sum;
}
/** Adds a bidirectional friendship edge. Safe to call with matching ids —
 *  self-referrals are ignored. */
export function addFriendship(a, b) {
    if (a === b)
        return;
    const db = load();
    const ka = String(a);
    const kb = String(b);
    const sa = new Set(db.friends[ka] ?? []);
    const sb = new Set(db.friends[kb] ?? []);
    sa.add(kb);
    sb.add(ka);
    db.friends[ka] = [...sa];
    db.friends[kb] = [...sb];
    save();
}
export function friendsOf(id) {
    return load().friends[String(id)] ?? [];
}
export function putResult(dateId, userId, record) {
    const db = load();
    const day = (db.results[dateId] ??= {});
    day[String(userId)] = record;
    save();
}
export function resultsOn(dateId) {
    return load().results[dateId] ?? {};
}
export function allUserIds() {
    return Object.keys(load().users);
}
