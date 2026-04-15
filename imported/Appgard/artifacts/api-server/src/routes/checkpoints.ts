import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, checkpointsTable, activityLogTable, usersTable } from "@workspace/db";
import {
  CreateCheckpointBody,
  CheckinCheckpointParams,
  CheckinCheckpointBody,
  ListCheckpointsQueryParams,
} from "@workspace/api-zod";
import { getUserIdFromAuth, requireAuth } from "./auth";

const router: IRouter = Router();
const MAX_CHECKPOINT_RADIUS_METERS = 35;

function formatCheckpoint(c: any) {
  return {
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
  };
}

router.get("/checkpoints", requireAuth(), async (req, res): Promise<void> => {
  const params = ListCheckpointsQueryParams.safeParse(req.query);
  if (!params.success || !params.data.roundId) {
    res.status(400).json({ error: "roundId is required" });
    return;
  }

  const checkpoints = await db
    .select()
    .from(checkpointsTable)
    .where(eq(checkpointsTable.roundId, params.data.roundId))
    .orderBy(checkpointsTable.orderIndex);

  res.json(checkpoints.map(formatCheckpoint));
});

router.post("/checkpoints", requireAuth(["supervisor", "admin"]), async (req, res): Promise<void> => {
  const parsed = CreateCheckpointBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [checkpoint] = await db
    .insert(checkpointsTable)
    .values({
      ...parsed.data,
      radius: Math.min(parsed.data.radius ?? MAX_CHECKPOINT_RADIUS_METERS, MAX_CHECKPOINT_RADIUS_METERS),
    })
    .returning();

  res.status(201).json(formatCheckpoint(checkpoint));
});

router.post("/checkpoints/:id/checkin", requireAuth(), async (req, res): Promise<void> => {
  const params = CheckinCheckpointParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CheckinCheckpointBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [checkpoint] = await db
    .select()
    .from(checkpointsTable)
    .where(eq(checkpointsTable.id, params.data.id));

  if (!checkpoint) {
    res.status(404).json({ error: "Punto de control no encontrado" });
    return;
  }

  const distance = getDistanceInMeters(
    parsed.data.latitude,
    parsed.data.longitude,
    checkpoint.latitude,
    checkpoint.longitude,
  );

  const allowedRadius = Math.min(checkpoint.radius, MAX_CHECKPOINT_RADIUS_METERS);

  if (distance > allowedRadius) {
    res.status(400).json({ error: `Demasiado lejos del punto de control. Distancia: ${Math.round(distance)}m, Radio permitido: ${allowedRadius}m` });
    return;
  }

  const userId = getUserIdFromAuth(req);

  const [updated] = await db
    .update(checkpointsTable)
    .set({
      checkedIn: true,
      checkedInAt: new Date(),
      checkedInById: userId,
    })
    .where(eq(checkpointsTable.id, params.data.id))
    .returning();

  if (userId) {
    await db.insert(activityLogTable).values({
      type: "checkpoint_reached",
      description: `Punto "${checkpoint.name}" alcanzado`,
      userId,
    });
  }

  res.json(formatCheckpoint(updated));
});

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default router;
