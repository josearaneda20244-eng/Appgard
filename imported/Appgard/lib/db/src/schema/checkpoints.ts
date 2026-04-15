import { pgTable, text, serial, timestamp, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roundsTable } from "./rounds";
import { usersTable } from "./users";

export const checkpointsTable = pgTable("checkpoints", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull().references(() => roundsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radius: doublePrecision("radius").notNull().default(35),
  orderIndex: integer("order_index").notNull().default(0),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedInById: integer("checked_in_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCheckpointSchema = createInsertSchema(checkpointsTable).omit({ id: true, createdAt: true });
export type InsertCheckpoint = z.infer<typeof insertCheckpointSchema>;
export type Checkpoint = typeof checkpointsTable.$inferSelect;
