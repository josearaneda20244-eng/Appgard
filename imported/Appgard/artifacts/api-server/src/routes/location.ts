import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, guardLocationsTable, usersTable, roundsTable } from "@workspace/db";
import { UpdateLocationBody } from "@workspace/api-zod";
import { getUserIdFromAuth, requireAuth } from "./auth";

const router: IRouter = Router();

router.post("/location/update", requireAuth(), async (req, res): Promise<void> => {
  const parsed = UpdateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const [activeRound] = await db
    .select({ id: roundsTable.id })
    .from(roundsTable)
    .where(and(eq(roundsTable.assignedToId, userId), eq(roundsTable.status, "active")));

  const status = activeRound ? "on_round" : "online";

  await db
    .insert(guardLocationsTable)
    .values({
      userId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      status,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: guardLocationsTable.userId,
      set: {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        updatedAt: new Date(),
        status,
      },
    });

  res.json({ message: "Ubicacion actualizada" });
});

router.get("/location/guards", requireAuth(["supervisor", "admin"]), async (_req, res): Promise<void> => {
  const locations = await db.select().from(guardLocationsTable);

  const result = await Promise.all(
    locations.map(async (loc) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, loc.userId));
      return {
        userId: loc.userId,
        userName: u?.name ?? "Desconocido",
        latitude: loc.latitude,
        longitude: loc.longitude,
        updatedAt: loc.updatedAt.toISOString(),
        status: loc.status,
      };
    }),
  );

  res.json(result);
});

export default router;
