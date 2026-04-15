import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, incidentsTable, usersTable, activityLogTable } from "@workspace/db";
import {
  CreateIncidentBody,
  GetIncidentParams,
  UpdateIncidentParams,
  UpdateIncidentBody,
  ListIncidentsQueryParams,
} from "@workspace/api-zod";
import { getUserIdFromAuth } from "./auth";

const router: IRouter = Router();

function formatIncident(i: any, reportedByName: string) {
  return {
    id: i.id,
    title: i.title,
    description: i.description,
    priority: i.priority,
    status: i.status,
    reportedById: i.reportedById,
    reportedByName,
    latitude: i.latitude,
    longitude: i.longitude,
    createdAt: i.createdAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
  };
}

router.get("/incidents", async (req, res): Promise<void> => {
  const params = ListIncidentsQueryParams.safeParse(req.query);

  const conditions: any[] = [];
  if (params.success && params.data.status) {
    conditions.push(eq(incidentsTable.status, params.data.status));
  }
  if (params.success && params.data.priority) {
    conditions.push(eq(incidentsTable.priority, params.data.priority));
  }

  const incidents = conditions.length > 0
    ? await db.select().from(incidentsTable).where(and(...conditions)).orderBy(incidentsTable.createdAt)
    : await db.select().from(incidentsTable).orderBy(incidentsTable.createdAt);

  const result = await Promise.all(
    incidents.map(async (i) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, i.reportedById));
      return formatIncident(i, u?.name ?? "Desconocido");
    }),
  );

  res.json(result);
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const [incident] = await db
    .insert(incidentsTable)
    .values({
      ...parsed.data,
      reportedById: userId,
    })
    .returning();

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  await db.insert(activityLogTable).values({
    type: "incident_reported",
    description: `Incidente "${incident.title}" reportado`,
    userId,
  });

  res.status(201).json(formatIncident(incident, u?.name ?? "Desconocido"));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!incident) {
    res.status(404).json({ error: "Incidente no encontrado" });
    return;
  }

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, incident.reportedById));

  res.json(formatIncident(incident, u?.name ?? "Desconocido"));
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.status === "resolved") {
    updateData.resolvedAt = new Date();
  }

  const [incident] = await db
    .update(incidentsTable)
    .set(updateData)
    .where(eq(incidentsTable.id, params.data.id))
    .returning();

  if (!incident) {
    res.status(404).json({ error: "Incidente no encontrado" });
    return;
  }

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, incident.reportedById));

  res.json(formatIncident(incident, u?.name ?? "Desconocido"));
});

export default router;
