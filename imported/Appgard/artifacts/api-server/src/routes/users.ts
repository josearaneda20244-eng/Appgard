import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
  ListUsersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  let users;
  if (params.success && params.data.role) {
    users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, params.data.role))
      .orderBy(usersTable.name);
  } else {
    users = await db.select().from(usersTable).orderBy(usersTable.name);
  }

  res.json(
    users.map((u) => ({
      id: u.id,
      rut: u.rut,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      avatar: u.avatar,
      active: u.active,
      createdAt: u.createdAt.toISOString(),
    })),
  );
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.insert(usersTable).values(parsed.data).returning();

  res.status(201).json({
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

router.get("/users/:id", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
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

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
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

router.delete("/users/:id", async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
