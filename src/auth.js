// Cuentas: cada usuario tiene sus propias tablas, nada se mezcla.
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));

async function hash(password, salt) {
 const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
 return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256));
}

export async function ensureAuth(db) {
 await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS auth_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, salt TEXT, hash TEXT, is_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0)"),
  db.prepare("CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL)")
 ]);
}

// El primer usuario (administrador) usa las tablas de siempre; los demas, las suyas.
export function scoped(env, userId) {
 const prefix = userId === 1 ? "" : "u" + userId + "_";
 const DB = {
  prepare: sql => env.DB.prepare(sql.replace(/\bsc_/g, prefix + "sc_")),
  batch: list => env.DB.batch(list)
 };
 return { ...env, DB, PREFIX: prefix };
}

function checkNew(username, password) {
 if (!/^[a-z0-9._-]{3,30}$/.test(username)) return "Usuario: 3 a 30 letras o números, sin espacios.";
 if (password.length < 8) return "La contraseña necesita al menos 8 caracteres.";
 return "";
}

async function session(db, user) {
 const token = random();
 await db.prepare("INSERT INTO auth_sessions (token,user_id) VALUES (?,?)").bind(token, user.id).run();
 return { token, username: user.username, admin: !!user.is_admin };
}

// Devuelve {response} para las rutas de cuentas, o {user} para el resto.
export async function handleAuth(request, env, path, json) {
 const db = env.DB, method = request.method;
 await ensureAuth(db);
 const body = method === "POST" ? await request.clone().json().catch(() => ({})) : {};
 const username = String(body.username || "").trim().toLowerCase();
 const password = String(body.password || "");
 const reply = (d, s) => ({ response: json(d, s) });
 const count = async () => (await db.prepare("SELECT COUNT(*) AS n FROM auth_users").first()).n;

 if (path === "/api/auth/state") return reply({ setup: !(await count()) });

 if (path === "/api/auth/setup" && method === "POST") {
  if (await count()) return reply({ error: "Ya existe el administrador." }, 403);
  const bad = checkNew(username, password);
  if (bad) return reply({ error: bad }, 400);
  const salt = random();
  // id fijo 1: si dos intentan a la vez, solo entra uno.
  await db.prepare("INSERT INTO auth_users (id,username,salt,hash,is_admin) VALUES (1,?,?,?,1)").bind(username, salt, await hash(password, salt)).run();
  return reply(await session(db, { id: 1, username, is_admin: 1 }));
 }

 if (path === "/api/auth/login" && method === "POST") {
  const u = await db.prepare("SELECT * FROM auth_users WHERE username=? AND active=1").bind(username).first();
  if (u && u.locked_until > Date.now()) return reply({ error: "Demasiados intentos. Esperá 15 minutos." }, 429);
  if (!u || (await hash(password, u.salt)) !== u.hash) {
   if (u) await db.prepare("UPDATE auth_users SET fails=CASE WHEN fails>=9 THEN 0 ELSE fails+1 END, locked_until=CASE WHEN fails>=9 THEN ? ELSE 0 END WHERE id=?").bind(Date.now() + 900000, u.id).run();
   return reply({ error: "Usuario o contraseña incorrectos." }, 401);
  }
  await db.prepare("UPDATE auth_users SET fails=0 WHERE id=?").bind(u.id).run();
  return reply(await session(db, u));
 }

 const token = request.headers.get("X-Admin-Token") || "";
 const user = token ? await db.prepare("SELECT u.id,u.username,u.is_admin FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token=? AND u.active=1").bind(token).first() : null;
 if (!user) return reply({ error: "Iniciá sesión." }, 401);

 if (path === "/api/auth/logout") {
  await db.prepare("DELETE FROM auth_sessions WHERE token=?").bind(token).run();
  return reply({ ok: true });
 }

 if (path === "/api/users" || path.startsWith("/api/users/")) {
  if (!user.is_admin) return reply({ error: "Solo el administrador." }, 403);
  if (method === "GET") return reply({ items: (await db.prepare("SELECT id,username,is_admin,active FROM auth_users WHERE active=1 ORDER BY id").all()).results });
  if (method === "POST") {
   const bad = checkNew(username, password);
   if (bad) return reply({ error: bad }, 400);
   const salt = random(), h = await hash(password, salt);
   const old = await db.prepare("SELECT id FROM auth_users WHERE username=?").bind(username).first();
   if (old) {
    await db.prepare("UPDATE auth_users SET salt=?,hash=?,active=1,fails=0,locked_until=0 WHERE id=?").bind(salt, h, old.id).run();
    if (old.id !== user.id) await db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(old.id).run();
    return reply({ ok: true, changed: true });
   }
   await db.prepare("INSERT INTO auth_users (username,salt,hash) VALUES (?,?,?)").bind(username, salt, h).run();
   return reply({ ok: true });
  }
  const id = Number(path.split("/").pop());
  if (method === "DELETE" && id > 1) {
   await db.prepare("UPDATE auth_users SET active=0 WHERE id=?").bind(id).run();
   await db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(id).run();
   return reply({ ok: true });
  }
  return reply({ error: "No se puede." }, 400);
 }
 return { user };
}
