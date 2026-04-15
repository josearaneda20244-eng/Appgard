import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, roundsTable, checkpointsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/seed", async (_req, res): Promise<void> => {
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      res.json({ message: "La base de datos ya tiene datos. Seed omitido.", seeded: false });
      return;
    }

    const [guard] = await db
      .insert(usersTable)
      .values({
        rut: "11.111.111-1",
        name: "Carlos Guardia",
        email: "guardia@gardsecurity.cl",
        phone: "+56 9 1111 1111",
        role: "guard",
        accessCode: "1234",
        active: true,
      })
      .returning();

    const [supervisor] = await db
      .insert(usersTable)
      .values({
        rut: "22.222.222-2",
        name: "Ana Supervisora",
        email: "supervisor@gardsecurity.cl",
        phone: "+56 9 2222 2222",
        role: "supervisor",
        accessCode: "2222",
        active: true,
      })
      .returning();

    const [admin] = await db
      .insert(usersTable)
      .values({
        rut: "33.333.333-3",
        name: "Roberto Jefe",
        email: "jefe@gardsecurity.cl",
        phone: "+56 9 3333 3333",
        role: "admin",
        accessCode: "3333",
        active: true,
      })
      .returning();

    const [guard2] = await db
      .insert(usersTable)
      .values({
        rut: "44.444.444-4",
        name: "Maria Guardia",
        email: "guardia2@gardsecurity.cl",
        phone: "+56 9 4444 4444",
        role: "guard",
        accessCode: "4444",
        active: true,
      })
      .returning();

    const [round1] = await db
      .insert(roundsTable)
      .values({
        name: "Ronda Perimetro Norte",
        companyName: "Edificio Torre Central",
        description: "Recorrido por el perimetro norte del edificio, revisando accesos y estacionamientos.",
        status: "pending",
        shift: "dia",
        assignedToId: guard.id,
        createdById: supervisor.id,
      })
      .returning();

    await db.insert(checkpointsTable).values([
      { roundId: round1.id, name: "Porteria Principal", latitude: -33.4569, longitude: -70.6483, radius: 30, orderIndex: 0 },
      { roundId: round1.id, name: "Acceso Vehicular", latitude: -33.4572, longitude: -70.6480, radius: 30, orderIndex: 1 },
      { roundId: round1.id, name: "Estacionamiento B1", latitude: -33.4575, longitude: -70.6477, radius: 35, orderIndex: 2 },
      { roundId: round1.id, name: "Sala de Maquinas", latitude: -33.4578, longitude: -70.6474, radius: 25, orderIndex: 3 },
      { roundId: round1.id, name: "Perimetro Oriente", latitude: -33.4580, longitude: -70.6471, radius: 35, orderIndex: 4 },
    ]);

    const [round2] = await db
      .insert(roundsTable)
      .values({
        name: "Ronda Piso 1-5",
        companyName: "Edificio Torre Central",
        description: "Recorrido por los primeros pisos del edificio.",
        status: "pending",
        shift: "noche",
        assignedToId: guard.id,
        createdById: supervisor.id,
      })
      .returning();

    await db.insert(checkpointsTable).values([
      { roundId: round2.id, name: "Recepcion Piso 1", latitude: -33.4569, longitude: -70.6483, radius: 20, orderIndex: 0 },
      { roundId: round2.id, name: "Sala Reuniones P2", latitude: -33.4570, longitude: -70.6482, radius: 20, orderIndex: 1 },
      { roundId: round2.id, name: "Oficinas P3", latitude: -33.4571, longitude: -70.6481, radius: 20, orderIndex: 2 },
      { roundId: round2.id, name: "Escalera Sur P4", latitude: -33.4572, longitude: -70.6480, radius: 25, orderIndex: 3 },
    ]);

    await db
      .insert(roundsTable)
      .values({
        name: "Ronda Edificio Sur",
        companyName: "Centro Comercial Plaza",
        description: "Patrullaje nocturno del edificio sur y areas comunes.",
        status: "pending",
        shift: "noche",
        assignedToId: guard2.id,
        createdById: supervisor.id,
      });

    res.json({
      message: "Base de datos inicializada con datos de prueba.",
      seeded: true,
      credentials: [
        { rol: "Guardia", rut: "11.111.111-1", codigo: "1234", nombre: "Carlos Guardia" },
        { rol: "Guardia 2", rut: "44.444.444-4", codigo: "4444", nombre: "Maria Guardia" },
        { rol: "Supervisor", rut: "22.222.222-2", codigo: "2222", nombre: "Ana Supervisora" },
        { rol: "Jefe / Admin", rut: "33.333.333-3", codigo: "3333", nombre: "Roberto Jefe" },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Error al inicializar la base de datos" });
  }
});

router.get("/seed/status", async (_req, res): Promise<void> => {
  const users = await db.select({ rut: usersTable.rut, name: usersTable.name, role: usersTable.role }).from(usersTable);
  res.json({ totalUsers: users.length, users });
});

export default router;
