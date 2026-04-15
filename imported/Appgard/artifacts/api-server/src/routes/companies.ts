import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";

const router: IRouter = Router();

function fmt(c: typeof companiesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    rut: c.rut,
    address: c.address,
    contactName: c.contactName,
    contactPhone: c.contactPhone,
    contactEmail: c.contactEmail,
    notes: c.notes,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/companies", async (_req, res): Promise<void> => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.name);
  res.json(companies.map(fmt));
});

router.post("/companies", async (req, res): Promise<void> => {
  const { name, rut, address, contactName, contactPhone, contactEmail, notes } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "El nombre es requerido" });
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({ name: name.trim(), rut, address, contactName, contactPhone, contactEmail, notes })
    .returning();
  res.status(201).json(fmt(company));
});

router.patch("/companies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }

  const { name, rut, address, contactName, contactPhone, contactEmail, notes, active } = req.body;
  const updateData: Partial<typeof companiesTable.$inferInsert> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (rut !== undefined) updateData.rut = rut;
  if (address !== undefined) updateData.address = address;
  if (contactName !== undefined) updateData.contactName = contactName;
  if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
  if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
  if (notes !== undefined) updateData.notes = notes;
  if (active !== undefined) updateData.active = active;

  const [company] = await db.update(companiesTable).set(updateData).where(eq(companiesTable.id, id)).returning();
  if (!company) { res.status(404).json({ error: "Empresa no encontrada" }); return; }
  res.json(fmt(company));
});

router.delete("/companies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "ID inválido" }); return; }

  const [company] = await db.delete(companiesTable).where(eq(companiesTable.id, id)).returning();
  if (!company) { res.status(404).json({ error: "Empresa no encontrada" }); return; }
  res.sendStatus(204);
});

export default router;
