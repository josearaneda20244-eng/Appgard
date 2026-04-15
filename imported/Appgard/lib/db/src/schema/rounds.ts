import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const roundsTable = pgTable("rounds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull().default("Sin empresa asignada"),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  shift: text("shift").notNull().default("ambos"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRoundSchema = createInsertSchema(roundsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRound = z.infer<typeof insertRoundSchema>;
export type Round = typeof roundsTable.$inferSelect;
