import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, roundsTable, checkpointsTable, usersTable, activityLogTable } from "@workspace/db";
import {
  CreateRoundBody,
  GetRoundParams,
  UpdateRoundParams,
  UpdateRoundBody,
  DeleteRoundParams,
  StartRoundParams,
  CompleteRoundParams,
  ListRoundsQueryParams,
} from "@workspace/api-zod";
import { getUserIdFromAuth } from "./auth";

const router: IRouter = Router();

function formatRound(r: any, assignedToName: string | null, totalCheckpoints: number, completedCheckpoints: number) {
  return {
    id: r.id,
    name: r.name,
    companyName: r.companyName,
    description: r.description,
    status: r.status,
    shift: r.shift ?? "ambos",
    assignedToId: r.assignedToId,
    assignedToName,
    createdById: r.createdById,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    totalCheckpoints,
    completedCheckpoints,
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/rounds", async (req, res): Promise<void> => {
  const params = ListRoundsQueryParams.safeParse(req.query);

  const conditions: any[] = [];
  if (params.success && params.data.status) {
    conditions.push(eq(roundsTable.status, params.data.status));
  }
  if (params.success && params.data.assignedTo) {
    conditions.push(eq(roundsTable.assignedToId, params.data.assignedTo));
  }

  const rounds = conditions.length > 0
    ? await db.select().from(roundsTable).where(and(...conditions)).orderBy(roundsTable.createdAt)
    : await db.select().from(roundsTable).orderBy(roundsTable.createdAt);

  const result = await Promise.all(
    rounds.map(async (r) => {
      let assignedToName: string | null = null;
      if (r.assignedToId) {
        const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, r.assignedToId));
        assignedToName = u?.name ?? null;
      }
      const [cpCount] = await db.select({ total: sql<number>`count(*)`, completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)` }).from(checkpointsTable).where(eq(checkpointsTable.roundId, r.id));
      return formatRound(r, assignedToName, Number(cpCount?.total ?? 0), Number(cpCount?.completed ?? 0));
    }),
  );

  res.json(result);
});

router.post("/rounds", async (req, res): Promise<void> => {
  const parsed = CreateRoundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const [round] = await db
    .insert(roundsTable)
    .values({
      ...parsed.data,
      companyName: parsed.data.companyName.trim(),
      createdById: userId,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    })
    .returning();

  let assignedToName: string | null = null;
  if (round.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, round.assignedToId));
    assignedToName = u?.name ?? null;
  }

  res.status(201).json(formatRound(round, assignedToName, 0, 0));
});

router.get("/rounds/:id", async (req, res): Promise<void> => {
  const params = GetRoundParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.id, params.data.id));
  if (!round) {
    res.status(404).json({ error: "Ronda no encontrada" });
    return;
  }

  let assignedToName: string | null = null;
  if (round.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, round.assignedToId));
    assignedToName = u?.name ?? null;
  }

  const checkpoints = await db.select().from(checkpointsTable).where(eq(checkpointsTable.roundId, round.id)).orderBy(checkpointsTable.orderIndex);
  const totalCheckpoints = checkpoints.length;
  const completedCheckpoints = checkpoints.filter((c) => c.checkedIn).length;

  res.json({
    round: formatRound(round, assignedToName, totalCheckpoints, completedCheckpoints),
    checkpoints: checkpoints.map((c) => ({
      id: c.id,
      roundId: c.roundId,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      radius: c.radius,
      orderIndex: c.orderIndex,
      checkedIn: c.checkedIn,
      checkedInAt: c.checkedInAt?.toISOString() ?? null,
      checkedInById: c.checkedInById,
    })),
  });
});

router.patch("/rounds/:id", async (req, res): Promise<void> => {
  const params = UpdateRoundParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRoundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [round] = await db
    .update(roundsTable)
    .set({
      ...parsed.data,
      companyName: parsed.data.companyName?.trim(),
    })
    .where(eq(roundsTable.id, params.data.id))
    .returning();

  if (!round) {
    res.status(404).json({ error: "Ronda no encontrada" });
    return;
  }

  let assignedToName: string | null = null;
  if (round.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, round.assignedToId));
    assignedToName = u?.name ?? null;
  }

  const [cpCount] = await db.select({ total: sql<number>`count(*)`, completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)` }).from(checkpointsTable).where(eq(checkpointsTable.roundId, round.id));

  res.json(formatRound(round, assignedToName, Number(cpCount?.total ?? 0), Number(cpCount?.completed ?? 0)));
});

router.delete("/rounds/:id", async (req, res): Promise<void> => {
  const params = DeleteRoundParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [round] = await db.delete(roundsTable).where(eq(roundsTable.id, params.data.id)).returning();
  if (!round) {
    res.status(404).json({ error: "Ronda no encontrada" });
    return;
  }

  res.sendStatus(204);
});

router.post("/rounds/:id/start", async (req, res): Promise<void> => {
  const params = StartRoundParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existingRound] = await db.select().from(roundsTable).where(eq(roundsTable.id, params.data.id));
  if (!existingRound) {
    res.status(404).json({ error: "Ronda no encontrada" });
    return;
  }

  await db
    .update(checkpointsTable)
    .set({ checkedIn: false, checkedInAt: null, checkedInById: null })
    .where(eq(checkpointsTable.roundId, params.data.id));

  const [round] = await db
    .update(roundsTable)
    .set({ status: "active", startedAt: new Date(), completedAt: null })
    .where(eq(roundsTable.id, params.data.id))
    .returning();

  const userId = getUserIdFromAuth(req);
  if (userId) {
    await db.insert(activityLogTable).values({
      type: "round_started",
      description: `Ronda "${round.name}" iniciada`,
      userId,
    });
  }

  let assignedToName: string | null = null;
  if (round.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, round.assignedToId));
    assignedToName = u?.name ?? null;
  }
  const [cpCount] = await db.select({ total: sql<number>`count(*)`, completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)` }).from(checkpointsTable).where(eq(checkpointsTable.roundId, round.id));

  res.json(formatRound(round, assignedToName, Number(cpCount?.total ?? 0), Number(cpCount?.completed ?? 0)));
});

router.post("/rounds/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteRoundParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [round] = await db
    .update(roundsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(roundsTable.id, params.data.id))
    .returning();

  if (!round) {
    res.status(404).json({ error: "Ronda no encontrada" });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (userId) {
    await db.insert(activityLogTable).values({
      type: "round_completed",
      description: `Ronda "${round.name}" completada`,
      userId,
    });
  }

  let assignedToName: string | null = null;
  if (round.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, round.assignedToId));
    assignedToName = u?.name ?? null;
  }
  const [cpCount] = await db.select({ total: sql<number>`count(*)`, completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)` }).from(checkpointsTable).where(eq(checkpointsTable.roundId, round.id));

  res.json(formatRound(round, assignedToName, Number(cpCount?.total ?? 0), Number(cpCount?.completed ?? 0)));
});

export default router;
