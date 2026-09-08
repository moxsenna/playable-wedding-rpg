// M10 logic oracle: protocol envelopes + interpolation math + remote store
// + net client behavior (fake socket + fake clock, no network).
// Prints M10 PROTOCOL VERIFIED only when every assertion passes.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => { console.error(`M10 logic check FAILED: ${msg}`); process.exit(1); };

const gameRequire = createRequire(join(ROOT, "packages/game/package.json"));
let ts;
try {
  ts = gameRequire("typescript");
} catch {
  fail("typescript not installed in packages/game");
}

const tmp = mkdtempSync(join(ROOT, "packages/contracts", ".tmp-m10logic-"));
try {
  for (const [dir, name] of [
    ["packages/contracts/src", "shared"],
    ["packages/contracts/src", "protocol"],
    ["packages/game/src/networking", "interpolation"],
    ["packages/game/src/networking", "remote-store"],
    ["packages/game/src/networking", "net-client"],
  ]) {
    const src = readFileSync(join(ROOT, dir, `${name}.ts`), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    if (out.diagnostics && out.diagnostics.length > 0) fail(`transpile errors in ${name}.ts`);
    writeFileSync(join(tmp, `${name}.js`), out.outputText);
  }
  const shimDir = join(tmp, "node_modules", "@wedding-rpg", "contracts");
  mkdirSync(shimDir, { recursive: true });
  writeFileSync(join(shimDir, "package.json"), JSON.stringify({ name: "@wedding-rpg/contracts", main: "index.js" }));
  writeFileSync(
    join(shimDir, "index.js"),
    `module.exports = Object.assign({}, require("../../../shared.js"), require("../../../protocol.js"));`
  );

  const req = createRequire(join(tmp, "x.js"));
  const proto = req(join(tmp, "protocol.js"));
  const interp = req(join(tmp, "interpolation.js"));
  const store = req(join(tmp, "remote-store.js"));
  const net = req(join(tmp, "net-client.js"));

  let n = 0;
  const ok = (cond, msg) => {
    n++;
    if (!cond) fail(`assertion ${n}: ${msg}`);
  };
  const env = (type, payload, extra = {}) =>
    JSON.stringify({ v: 1, type, payload, ...extra });

  // --- envelopes ---
  ok(!proto.checkEnvelope("x".repeat(5000), proto.serverMessageTypes).ok, "oversize frame rejected");
  ok(!proto.checkEnvelope("{nope", proto.serverMessageTypes).ok, "malformed json rejected");
  ok(!proto.checkEnvelope(env("player.snapshot", {}).replace('"v":1', '"v":2'), proto.serverMessageTypes).ok, "wrong version rejected");
  ok(!proto.checkEnvelope(env("-delete-all", {}), proto.serverMessageTypes).ok, "unknown type rejected");
  ok(proto.checkEnvelope(env("player.left", { playerId: "p_1" }), proto.serverMessageTypes).ok, "known type passes");

  // --- payload schemas ---
  const goodMove = { x: 1, y: 2, vx: 100, vy: 0, facing: "right", movement: "walk" };
  ok(proto.movePayloadSchema.safeParse(goodMove).success, "good move parses");
  ok(!proto.movePayloadSchema.safeParse({ ...goodMove, vx: 9999 }).success, "velocity budget enforced");
  ok(proto.helloPayloadSchema.safeParse({ session: "sess.opaque", clientVersion: "1.0.0" }).success, "session hello parses");
  ok(!proto.helloPayloadSchema.safeParse({ mapId: "garden-village-v1", avatarId: "guest_01", clientVersion: "1.0.0" }).success, "legacy mapId/avatarId hello rejected");
  ok(!proto.movePayloadSchema.safeParse({ ...goodMove, facing: "north" }).success, "facing allowlisted");
  ok(!proto.movePayloadSchema.safeParse({ ...goodMove, x: Infinity }).success, "finite coords enforced");
  ok(!proto.emotePayloadSchema.safeParse({ emote: "shout" }).success, "emote allowlisted");
  ok(proto.emotePayloadSchema.safeParse({ emote: "wave" }).success, "wave emote parses");

  // --- interpolation ---
  const buf = new interp.SnapshotBuffer();
  buf.push({ serverTs: 1000, x: 0, y: 0, vx: 100, vy: 0 });
  buf.push({ serverTs: 1100, x: 10, y: 0, vx: 100, vy: 0 });
  let s = buf.sample(1050);
  ok(Math.abs(s.x - 5) < 1e-9 && !s.settled, "midpoint lerps");
  s = buf.sample(900);
  ok(s.x === 0, "pre-roll clamps to first");
  buf.push({ serverTs: 900, x: -99, y: 0, vx: 0, vy: 0 });
  s = buf.sample(950);
  ok(s.x === 0, "out-of-order snapshot dropped");
  s = buf.sample(1200);
  ok(Math.abs(s.x - 20) < 1e-9 && !s.settled, "short extrapolation follows velocity");
  s = buf.sample(2000);
  ok(s.x === 10 && s.settled, "long gap settles on last");

  // --- remote store ---
  const rs = new store.RemotePlayerStore();
  rs.join({ playerId: "p_1", displayName: "Maya", avatarId: "guest_01", x: 0, y: 0, facing: "up" }, 1000);
  ok(rs.count() === 1, "join tracked");
  ok(rs.snapshot({ playerId: "p_x", x: 0, y: 0, vx: 0, vy: 0, facing: "up", movement: "walk" }, 1100, 1100) === null, "snapshot for unknown ignored");
  rs.snapshot({ playerId: "p_1", x: 10, y: 0, vx: 100, vy: 0, facing: "right", movement: "walk" }, 1100, 1100);
  ok(rs.emote("p_1", "wave", 5000), "emote stored");
  ok(!rs.emote("p_x", "wave", 5000), "emote for unknown fails");
  ok(rs.prune(17000).length === 1 && rs.count() === 0, "stale player pruned");

  // --- net client over a fake socket + clock ---
  const mkSock = () => {
    const sock = {
      sent: [],
      closed: false,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(d) { sock.sent.push(d); },
      close() { sock.closed = true; },
    };
    return sock;
  };
  let now = 100000;
  const seen = [];
  const mkClient = (sock, events = {}) =>
    new net.NetClient(
      { openSocket: () => sock, now: () => now },
      {
        onState: (st) => seen.push(`state:${st}`),
        onError: (e) => seen.push(`error:${e}`),
        onSnapshot: (p, ts) => seen.push(`snap:${p.playerId}@${ts}`),
        onLeft: (id) => seen.push(`left:${id}`),
        ...events,
      }
    );
  const sock = mkSock();
  const client = mkClient(sock);
  client.connect("sess.opaque-token");
  ok(seen[0] === "state:connecting", "connecting first");
  sock.onopen();
  ok(sock.sent.length === 1 && JSON.parse(sock.sent[0]).type === "client.hello", "hello on open");
  ok(JSON.parse(sock.sent[0]).payload.session === "sess.opaque-token", "hello carries the session, not identity");
  ok(!("avatarId" in JSON.parse(sock.sent[0]).payload), "hello carries no client-chosen avatar");
  const move = { x: 10, y: 20, vx: 100, vy: 0, facing: "right", movement: "walk" };
  ok(client.sendMove(move), "first move sends");
  ok(!client.sendMove({ ...move }), "unchanged move dropped");
  ok(!client.sendMove({ ...move, x: 11 }), "100ms throttle holds");
  now += 150;
  ok(client.sendMove({ ...move, x: 11 }), "move sends after interval");
  ok(!client.sendMove({ ...move, x: 12, vx: 9999 }), "invalid move never sends");
  ok(client.sendIdle({ x: 11, y: 20, facing: "right" }), "idle sends immediately");
  ok(client.sendEmote({ emote: "wave" }), "emote sends");
  ok(!client.sendEmote({ emote: "heart" }), "emote rate-limited");
  now += 2500;
  ok(client.sendEmote({ emote: "heart" }), "emote sends after window");

  // inbound: snapshot + left dispatch; strikes close after 3 bad frames
  sock.onmessage({ data: env("player.snapshot", { playerId: "p_9", x: 1, y: 1, vx: 0, vy: 0, facing: "up", movement: "walk" }, { ts: 777 }) });
  ok(seen.includes("snap:p_9@777"), "snapshot dispatched with server ts");
  sock.onmessage({ data: env("player.left", { playerId: "p_9" }) });
  ok(seen.includes("left:p_9"), "left dispatched");
  sock.onmessage({ data: "garbage{" });
  sock.onmessage({ data: env("player.snapshot", { playerId: 7 }, {}) });
  sock.onmessage({ data: env("nuke.room", {}) });
  ok(sock.closed, "three strikes close the socket");

  console.log(`M10 PROTOCOL VERIFIED (${n} assertions)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
