import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, panicAlertsTable, usersTable, activityLogTable } from "@workspace/db";
import { TriggerPanicBody, ResolvePanicParams } from "@workspace/api-zod";
import { getUserIdFromAuth, requireAuth } from "./auth";

const router: IRouter = Router();

function formatPanic(p: any, userName: string) {
  return {
    id: p.id,
    userId: p.userId,
    userName,
    latitude: p.latitude,
    longitude: p.longitude,
    status: p.status,
    message: p.message,
    createdAt: p.createdAt.toISOString(),
    resolvedAt: p.resolvedAt?.toISOString() ?? null,
  };
}

router.get("/panic", requireAuth(["supervisor", "admin"]), async (_req, res): Promise<void> => {
  const alerts = await db.select().from(panicAlertsTable).orderBy(panicAlertsTable.createdAt);

  const result = await Promise.all(
    alerts.map(async (p) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, p.userId));
      return formatPanic(p, u?.name ?? "Desconocido");
    }),
  );

  res.json(result);
});

router.post("/panic", requireAuth(), async (req, res): Promise<void> => {
  const parsed = TriggerPanicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const [alert] = await db
    .insert(panicAlertsTable)
    .values({
      userId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      message: parsed.data.message,
    })
    .returning();

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  await db.insert(activityLogTable).values({
    type: "panic_triggered",
    description: `Alerta de panico activada por ${u?.name ?? "Desconocido"}`,
    userId,
  });

  res.status(201).json(formatPanic(alert, u?.name ?? "Desconocido"));
});

router.post("/panic/:id/resolve", requireAuth(["supervisor", "admin"]), async (req, res): Promise<void> => {
  const params = ResolvePanicParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [alert] = await db
    .update(panicAlertsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(panicAlertsTable.id, params.data.id))
    .returning();

  if (!alert) {
    res.status(404).json({ error: "Alerta no encontrada" });
    return;
  }

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, alert.userId));

  const userId = getUserIdFromAuth(req);
  if (userId) {
    await db.insert(activityLogTable).values({
      type: "panic_resolved",
      description: `Alerta de panico de ${u?.name ?? "Desconocido"} resuelta`,
      userId,
    });
  }

  res.json(formatPanic(alert, u?.name ?? "Desconocido"));
});

export default router;
