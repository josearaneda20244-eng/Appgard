import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import { db, usersTable, roundsTable, checkpointsTable, incidentsTable, panicAlertsTable, activityLogTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [guardCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(eq(usersTable.role, "guard"));

  const [activeGuardCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(and(eq(usersTable.role, "guard"), eq(usersTable.active, true)));

  const [activeRounds] = await db
    .select({ count: sql<number>`count(*)` })
    .from(roundsTable)
    .where(eq(roundsTable.status, "active"));

  const [completedToday] = await db
    .select({ count: sql<number>`count(*)` })
    .from(roundsTable)
    .where(and(eq(roundsTable.status, "completed"), gte(roundsTable.completedAt, today)));

  const [openIncidents] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incidentsTable)
    .where(eq(incidentsTable.status, "open"));

  const [activePanic] = await db
    .select({ count: sql<number>`count(*)` })
    .from(panicAlertsTable)
    .where(eq(panicAlertsTable.status, "active"));

  res.json({
    totalGuards: Number(guardCount?.count ?? 0),
    activeGuards: Number(activeGuardCount?.count ?? 0),
    activeRounds: Number(activeRounds?.count ?? 0),
    completedRoundsToday: Number(completedToday?.count ?? 0),
    openIncidents: Number(openIncidents?.count ?? 0),
    activePanicAlerts: Number(activePanic?.count ?? 0),
  });
});

router.get("/dashboard/activity", async (_req, res): Promise<void> => {
  const activities = await db
    .select()
    .from(activityLogTable)
    .orderBy(sql`${activityLogTable.createdAt} desc`)
    .limit(20);

  const result = await Promise.all(
    activities.map(async (a) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, a.userId));
      return {
        id: a.id,
        type: a.type,
        description: a.description,
        userName: u?.name ?? "Desconocido",
        createdAt: a.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

router.get("/dashboard/round-stats", async (_req, res): Promise<void> => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const roundsThisWeek = await db
    .select()
    .from(roundsTable)
    .where(gte(roundsTable.createdAt, weekAgo));

  // For each round that was started, compute actual checkpoint completion score
  const startedRounds = roundsThisWeek.filter((r) => r.status === "active" || r.status === "completed");

  let totalScore = 0;
  let roundsWithData = 0;

  const roundScores = await Promise.all(
    startedRounds.map(async (r) => {
      const [cpCount] = await db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)`,
        })
        .from(checkpointsTable)
        .where(eq(checkpointsTable.roundId, r.id));

      const total = Number(cpCount?.total ?? 0);
      const completed = Number(cpCount?.completed ?? 0);
      const score = total > 0 ? (completed / total) * 100 : 0;

      if (total > 0) {
        totalScore += score;
        roundsWithData++;
      }

      return { round: r, total, completed, score };
    }),
  );

  // Average checkpoint completion rate across all started rounds
  const completionRate = roundsWithData > 0 ? totalScore / roundsWithData : 0;

  // Average time for fully started+completed rounds
  const completedRounds = roundsThisWeek.filter((r) => r.completedAt && r.startedAt);
  const avgTime =
    completedRounds.length > 0
      ? completedRounds.reduce((sum, r) => sum + (r.completedAt!.getTime() - r.startedAt!.getTime()), 0) /
        completedRounds.length /
        60000
      : 0;

  // Per-day: show average checkpoint score for that day
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const roundsByDay = days.map((day, idx) => {
    const dayRoundScores = roundScores.filter((rs) => rs.round.createdAt.getDay() === idx);
    const dayTotal = dayRoundScores.length;
    const dayCompleted = dayRoundScores.filter((rs) => rs.score >= 100).length;
    const avgScore = dayTotal > 0
      ? Math.round(dayRoundScores.reduce((sum, rs) => sum + rs.score, 0) / dayTotal)
      : 0;
    return {
      day,
      total: dayTotal,
      completed: dayCompleted,
      avgScore,
    };
  });

  res.json({
    totalRoundsThisWeek: roundsThisWeek.length,
    completedRoundsThisWeek: completedRounds.length,
    completionRate: Math.round(completionRate * 10) / 10,
    averageCompletionTime: Math.round(avgTime * 10) / 10,
    roundsByDay,
  });
});

// Top companies by average checkpoint completion score
router.get("/dashboard/company-stats", async (_req, res): Promise<void> => {
  const allRounds = await db.select().from(roundsTable);
  const startedRounds = allRounds.filter((r) => r.status === "active" || r.status === "completed");

  const companyMap: Record<string, { totalScore: number; count: number; completed: number }> = {};

  await Promise.all(
    startedRounds.map(async (r) => {
      const company = r.companyName;
      if (!companyMap[company]) {
        companyMap[company] = { totalScore: 0, count: 0, completed: 0 };
      }

      const [cpCount] = await db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)`,
        })
        .from(checkpointsTable)
        .where(eq(checkpointsTable.roundId, r.id));

      const total = Number(cpCount?.total ?? 0);
      const completed = Number(cpCount?.completed ?? 0);
      const score = total > 0 ? (completed / total) * 100 : 0;

      companyMap[company].totalScore += score;
      companyMap[company].count++;
      if (score >= 100) companyMap[company].completed++;
    }),
  );

  const companies = Object.entries(companyMap)
    .map(([name, data]) => ({
      name,
      avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
      totalRounds: data.count,
      fullyCompleted: data.completed,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  res.json(companies);
});

// Per-guard performance
router.get("/dashboard/guard-performance", async (_req, res): Promise<void> => {
  const guards = await db.select().from(usersTable).where(eq(usersTable.role, "guard"));

  const result = await Promise.all(
    guards.map(async (guard) => {
      const rounds = await db
        .select()
        .from(roundsTable)
        .where(eq(roundsTable.assignedToId, guard.id));

      const startedRounds = rounds.filter((r) => r.status === "active" || r.status === "completed");
      if (startedRounds.length === 0) {
        return { guardId: guard.id, guardName: guard.name, avgScore: 0, totalRounds: 0, startedRounds: 0 };
      }

      let totalScore = 0;
      await Promise.all(
        startedRounds.map(async (r) => {
          const [cpCount] = await db
            .select({
              total: sql<number>`count(*)`,
              completed: sql<number>`count(*) filter (where ${checkpointsTable.checkedIn} = true)`,
            })
            .from(checkpointsTable)
            .where(eq(checkpointsTable.roundId, r.id));

          const total = Number(cpCount?.total ?? 0);
          const completed = Number(cpCount?.completed ?? 0);
          totalScore += total > 0 ? (completed / total) * 100 : 0;
        }),
      );

      return {
        guardId: guard.id,
        guardName: guard.name,
        avgScore: Math.round((totalScore / startedRounds.length) * 10) / 10,
        totalRounds: rounds.length,
        startedRounds: startedRounds.length,
      };
    }),
  );

  res.json(result.sort((a, b) => b.avgScore - a.avgScore));
});

export default router;
