import express from 'express';
import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import { validateInitData } from './initData.js';
import { addFriendship, allUserIds, friendsOf, load as loadDB, putResult, resultsOn, touchUser, } from './db.js';
import { sendMessage } from './telegram.js';
const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
const PORT = Number(process.env.PORT) || 3000;
const DIST = path.resolve(process.cwd(), 'dist');
// --------------------------------------------------------------------------
// Shared — Kyiv ISO date helper (mirror of src/lib/kyivDate.ts for the server).
// --------------------------------------------------------------------------
function kyivIsoDate(d = new Date()) {
    // Europe/Kyiv in ISO — pick y-m-d from Intl in that tz.
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${y}-${m}-${day}`;
}
// --------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '128kb' }));
/** Pull + validate initData from the incoming body, returning the Telegram
 *  user on success or null (caller responds with 401). */
function authed(body) {
    if (!BOT_TOKEN)
        return null;
    const raw = body && typeof body === 'object' && 'initData' in body
        ? body.initData
        : null;
    if (typeof raw !== 'string' || !raw)
        return null;
    return validateInitData(raw, BOT_TOKEN);
}
app.post('/api/register', (req, res) => {
    const user = authed(req.body);
    if (!user) {
        console.log('[register] 401 — bad initData');
        return res.status(401).json({ ok: false });
    }
    touchUser(user.id, {
        firstName: user.first_name,
        username: user.username,
        languageCode: user.language_code,
    });
    // Optional referrer — from the same initData, the mini-app passes
    // `start_param` in the body if it looked like a `ref_<id>`. We also log
    // the raw `startParam` the client saw so we can tell whether Telegram
    // dropped it vs. our parsing failed.
    const body = req.body;
    const rawStartParam = body.startParam;
    // Fallback: if the client didn't parse a referrer but Telegram gave us a
    // ref_<id> start_param, parse it here.
    let referrer = Number(body.referrer);
    if ((!Number.isFinite(referrer) || referrer <= 0) && typeof rawStartParam === 'string') {
        const m = /^ref_(\d+)$/.exec(rawStartParam);
        if (m)
            referrer = Number(m[1]);
    }
    let linked = false;
    if (Number.isFinite(referrer) && referrer > 0 && referrer !== user.id) {
        addFriendship(user.id, referrer);
        linked = true;
    }
    const friends = friendsOf(user.id);
    console.log(`[register] user=${user.id} ref=${body.referrer ?? '-'} startParam=${JSON.stringify(rawStartParam)} linked=${linked} friends=${friends.length}`);
    return res.json({ ok: true, friends });
});
app.post('/api/result', async (req, res) => {
    const user = authed(req.body);
    if (!user)
        return res.status(401).json({ ok: false });
    touchUser(user.id, {
        firstName: user.first_name,
        username: user.username,
        languageCode: user.language_code,
    });
    const body = req.body;
    const r = body.result;
    if (!r ||
        typeof r.stars !== 'number' ||
        typeof r.opsUsed !== 'number' ||
        typeof r.distance !== 'number' ||
        typeof r.target !== 'number' ||
        typeof r.dateId !== 'string') {
        return res.status(400).json({ ok: false, error: 'bad-result' });
    }
    const dateId = r.dateId;
    const day = resultsOn(dateId);
    const alreadyFinished = Object.keys(day).filter((k) => k !== String(user.id));
    const record = {
        stars: Math.max(0, Math.min(3, r.stars)),
        opsUsed: r.opsUsed,
        closest: r.closest ?? null,
        distance: r.distance,
        target: r.target,
        finishedAt: Date.now(),
    };
    putResult(dateId, user.id, record);
    // Notify each friend whose first friend-of-the-day this is.
    const friends = friendsOf(user.id);
    const notifyCandidates = friends.filter((fid) => {
        // Skip if the player themselves hasn't connected to that friend (the
        // friendship list is bidirectional so this shouldn't happen, but belt
        // and braces).
        if (fid === String(user.id))
            return false;
        // Only notify if this is the first friend-of-theirs to finish today.
        const friendsResultsToday = friendsOf(Number(fid)).filter((x) => x !== fid);
        const anyAlreadyFinished = friendsResultsToday.some((x) => x !== String(user.id) && day[x] !== undefined && alreadyFinished.includes(x));
        return !anyAlreadyFinished;
    });
    const name = user.first_name || user.username || 'Твій друг';
    const starStr = '⭐'.repeat(record.stars) + '☆'.repeat(3 - record.stars);
    const text = `🧮 ${name} щойно розв'язав сьогоднішній Digits — ${starStr}. Спробуй побити?`;
    await Promise.all(notifyCandidates.map((fid) => sendMessage(fid, text, { openAppButton: 'Грати' })));
    return res.json({ ok: true, notified: notifyCandidates.length });
});
/** Telegram webhook — receives /start with optional `ref_<id>` parameter.
 *  Direct-link mini-app `?startapp=` doesn't propagate `start_param` for
 *  this bot, so use the classic deep-link `/start ref_<id>` instead and
 *  link the friendship server-side. Reply with an inline keyboard that
 *  launches the mini-app via web_app button. */
app.post('/api/tg-webhook', async (req, res) => {
    // Acknowledge first so Telegram doesn't retry on slow handlers.
    res.json({ ok: true });
    try {
        const update = req.body;
        const msg = update.message;
        const text = msg?.text;
        const chatId = msg?.chat?.id;
        const from = msg?.from;
        if (!text || !chatId || !from?.id)
            return;
        const m = /^\/start(?:\s+(\S+))?/i.exec(text);
        if (!m)
            return;
        const param = m[1] ?? null;
        let referrer = null;
        if (param) {
            const refMatch = /^ref_(\d+)$/.exec(param);
            if (refMatch)
                referrer = Number(refMatch[1]);
        }
        touchUser(from.id, {
            firstName: from.first_name,
            username: from.username,
            languageCode: from.language_code,
        });
        let linked = false;
        if (referrer !== null && referrer > 0 && referrer !== from.id) {
            addFriendship(from.id, referrer);
            linked = true;
        }
        console.log(`[webhook] /start from=${from.id} param=${param ?? '-'} linked=${linked}`);
        const greeting = linked
            ? '🧮 Digits — щоденний математичний пазл.\nДруг тебе запросив — тапай «Грати», ваші результати будуть бачити одне одного.'
            : '🧮 Digits — щоденний математичний пазл.\nСьогоднішня задача готова. Тапай «Грати»:';
        await sendMessage(chatId, greeting, { openAppButton: 'Грати' });
    }
    catch (err) {
        console.error('[webhook] error', err);
    }
});
/** Token-gated debug dump — used for operational sanity checks. The caller
 *  has to know the bot token so only the operator can see it. */
app.get('/api/debug/stats', (req, res) => {
    if (!BOT_TOKEN || req.query.token !== BOT_TOKEN) {
        return res.status(401).json({ ok: false });
    }
    const db = loadDB();
    return res.json({
        users: Object.keys(db.users).length,
        friendEdges: Object.fromEntries(Object.entries(db.friends).map(([k, v]) => [k, v.length])),
        resultsByDay: Object.fromEntries(Object.entries(db.results).map(([d, day]) => [d, Object.keys(day).length])),
    });
});
// Static files — bundle + serve.json headers.
const serveJsonPath = path.join(DIST, 'serve.json');
let serveConfig = {};
try {
    if (fs.existsSync(serveJsonPath)) {
        serveConfig = JSON.parse(fs.readFileSync(serveJsonPath, 'utf8'));
    }
}
catch {
    // Ignore — fall back to default express static caching.
}
app.use(express.static(DIST, {
    setHeaders(res, filePath) {
        if (!serveConfig.headers)
            return;
        const rel = path.relative(DIST, filePath).replace(/\\/g, '/');
        for (const rule of serveConfig.headers) {
            const re = new RegExp('^' + rule.source.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
            if (re.test(rel)) {
                for (const h of rule.headers)
                    res.setHeader(h.key, h.value);
            }
        }
    },
}));
// SPA fallback — any non-/api path returns index.html.
app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
});
// --------------------------------------------------------------------------
// Daily broadcast cron — 09:30 Europe/Kyiv. Morning "coffee + puzzle" slot
// lands after the commute crush but before the workday fully ramps, which
// matches the engagement window observed on NYT-style daily puzzles.
// --------------------------------------------------------------------------
cron.schedule('30 9 * * *', async () => {
    const ids = allUserIds();
    if (ids.length === 0)
        return;
    const dateId = kyivIsoDate();
    const text = `🧮 Digits на ${dateId}\nСьогоднішня задача вже готова — нова ціль і нові числа.`;
    console.log(`[cron] daily broadcast to ${ids.length} users`);
    for (const id of ids) {
        await sendMessage(id, text, { openAppButton: 'Грати' });
    }
}, { timezone: 'Europe/Kyiv' });
app.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}, token=${BOT_TOKEN ? 'yes' : 'missing'}`);
});
