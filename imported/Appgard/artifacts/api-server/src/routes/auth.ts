import { createHmac, randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateInitialAdminBody, LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_PREFIX = "pbkdf2";
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 32;

type Role = "guard" | "supervisor" | "admin";
type AuthenticatedUser = {
  id: number;
  rut: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  avatar: string | null;
  active: boolean;
  createdAt: string;
};

export type AuthenticatedRequest = Request & {
  currentUser?: AuthenticatedUser;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and contain at least 32 characters.");
  }
  return secret;
}

function normalizeRut(rut: string): string {
  return rut.trim();
}

export function hashAccessCode(accessCode: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(accessCode, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, "sha256").toString("base64url");
  return `${HASH_PREFIX}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyAccessCode(accessCode: string, stored: string): boolean {
  if (!stored.startsWith(`${HASH_PREFIX}$`)) {
    return accessCode === stored;
  }

  const [, iterationsRaw, salt, expected] = stored.split("$");
  const iterations = Number(iterationsRaw);
  if (!iterations || !salt || !expected) {
    return false;
  }

  const actual = pbkdf2Sync(accessCode, salt, iterations, HASH_KEY_LENGTH, "sha256").toString("base64url");
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function createToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): number | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { sub?: unknown; exp?: unknown };
    if (typeof parsed.sub !== "number" || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.sub;
  } catch {
    return null;
  }
}

function serializeUser(user: typeof usersTable.$inferSelect): AuthenticatedUser {
  return {
    id: user.id,
    rut: user.rut,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as Role,
    avatar: user.avatar,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}

async function getUserCount(): Promise<number> {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
  return Number(result?.count ?? 0);
}

router.get("/setup/status", async (_req, res): Promise<void> => {
  res.json({ needsSetup: (await getUserCount()) === 0 });
});

router.post("/setup/admin", async (req, res): Promise<void> => {
  if ((await getUserCount()) > 0) {
    res.status(409).json({ error: "La configuracion inicial ya fue completada." });
    return;
  }

  const parsed = CreateInitialAdminBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      rut: normalizeRut(parsed.data.rut),
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim(),
      phone: parsed.data.phone.trim(),
      role: "admin",
      accessCode: hashAccessCode(parsed.data.accessCode),
      active: true,
    })
    .returning();

  res.status(201).json({ user: serializeUser(user), token: createToken(user.id) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rut, accessCode } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.rut, normalizeRut(rut)));

  if (!user || !verifyAccessCode(accessCode, user.accessCode) || !user.active) {
    res.status(401).json({ error: "Credenciales invalidas" });
    return;
  }

  if (!user.accessCode.startsWith(`${HASH_PREFIX}$`)) {
    await db.update(usersTable).set({ accessCode: hashAccessCode(accessCode) }).where(eq(usersTable.id, user.id));
  }

  (req as any).session = (req as any).session || {};

  res.json({
    user: serializeUser(user),
    token: createToken(user.id),
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const userId = parseToken(authHeader.slice(7));
  if (!userId) {
    res.status(401).json({ error: "Token invalido" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user || !user.active) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(serializeUser(user));
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Sesion cerrada" });
});

export default router;

export function getUserIdFromAuth(req: any): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return parseToken(authHeader.slice(7));
}

export function requireAuth(roles?: Role[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || !user.active) {
      res.status(401).json({ error: "Usuario no autorizado" });
      return;
    }

    const serialized = serializeUser(user);
    if (roles && !roles.includes(serialized.role)) {
      res.status(403).json({ error: "No tienes permisos para esta accion" });
      return;
    }

    req.currentUser = serialized;
    next();
  };
}

export async function isLastActiveAdmin(userId: number): Promise<boolean> {
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target || target.role !== "admin" || !target.active) {
    return false;
  }

  const [activeAdmins] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(sql`${usersTable.role} = 'admin' and ${usersTable.active} = true`);

  return Number(activeAdmins?.count ?? 0) <= 1;
}
