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
import { hashAccessCode, isLastActiveAdmin, requireAuth, type AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

router.get("/users", requireAuth(["supervisor", "admin"]), async (req, res): Promise<void> => {
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

router.post("/users", requireAuth(["supervisor", "admin"]), async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.role === "admin" && req.currentUser?.role !== "admin") {
    res.status(403).json({ error: "Solo un administrador puede crear otro administrador" });
    return;
  }

  try {
    const [user] = await db.insert(usersTable).values({
      ...parsed.data,
      rut: parsed.data.rut.trim(),
      name: parsed.data.name.trim(),
      email: parsed.data.email.trim(),
      phone: parsed.data.phone.trim(),
      accessCode: hashAccessCode(parsed.data.accessCode),
    }).returning();

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
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ error: "Ya existe un usuario con ese RUT" });
      return;
    }
    throw error;
  }
});

router.get("/users/:id", requireAuth(["supervisor", "admin"]), async (req, res): Promise<void> => {
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

router.patch("/users/:id", requireAuth(["supervisor", "admin"]), async (req: AuthenticatedRequest, res): Promise<void> => {
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

  if (parsed.data.role === "admin" && req.currentUser?.role !== "admin") {
    res.status(403).json({ error: "Solo un administrador puede asignar el rol administrador" });
    return;
  }

  if ((parsed.data.active === false || (parsed.data.role && parsed.data.role !== "admin")) && await isLastActiveAdmin(params.data.id)) {
    res.status(409).json({ error: "No puedes desactivar o cambiar de rol al ultimo administrador activo" });
    return;
  }

  const updateData = {
    ...parsed.data,
    name: parsed.data.name?.trim(),
    email: parsed.data.email?.trim(),
    phone: parsed.data.phone?.trim(),
    accessCode: parsed.data.accessCode ? hashAccessCode(parsed.data.accessCode) : undefined,
  };

  const [user] = await db
    .update(usersTable)
    .set(updateData)
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

router.delete("/users/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (await isLastActiveAdmin(params.data.id)) {
    res.status(409).json({ error: "No puedes eliminar el ultimo administrador activo" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ active: false })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  res.sendStatus(204);
});

export default router;
