import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
    .where(eq(usersTable.rut, rut));

  if (!user || user.accessCode !== accessCode || !user.active) {
    res.status(401).json({ error: "Credenciales invalidas" });
    return;
  }

  const token = Buffer.from(`${user.id}:${Date.now()}`).toString("base64");

  (req as any).session = (req as any).session || {};

  res.json({
    user: {
      id: user.id,
      rut: user.rut,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
    },
    token,
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const token = authHeader.slice(7);
  let userId: number;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    userId = parseInt(decoded.split(":")[0], 10);
  } catch {
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

  res.json({
    id: user.id,
    rut: user.rut,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ message: "Sesion cerrada" });
});

export default router;

export function getUserIdFromAuth(req: any): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    return parseInt(decoded.split(":")[0], 10);
  } catch {
    return null;
  }
}
