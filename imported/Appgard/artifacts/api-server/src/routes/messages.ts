import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { SendMessageBody, ListMessagesQueryParams } from "@workspace/api-zod";
import { getUserIdFromAuth } from "./auth";

const router: IRouter = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const params = ListMessagesQueryParams.safeParse(req.query);
  const channelId = params.success ? params.data.channelId : undefined;

  let messages;
  if (channelId) {
    messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.channelId, channelId))
      .orderBy(messagesTable.createdAt);
  } else {
    messages = await db
      .select()
      .from(messagesTable)
      .orderBy(messagesTable.createdAt);
  }

  const result = await Promise.all(
    messages.map(async (m) => {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, m.senderId));
      return {
        id: m.id,
        channelId: m.channelId,
        senderId: m.senderId,
        senderName: u?.name ?? "Desconocido",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = getUserIdFromAuth(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      channelId: parsed.data.channelId,
      content: parsed.data.content,
      senderId: userId,
    })
    .returning();

  const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    id: message.id,
    channelId: message.channelId,
    senderId: message.senderId,
    senderName: u?.name ?? "Desconocido",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
});

export default router;
