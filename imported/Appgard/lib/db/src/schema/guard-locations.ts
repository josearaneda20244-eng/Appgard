import { pgTable, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const guardLocationsTable = pgTable("guard_locations", {
  userId: integer("user_id").primaryKey().references(() => usersTable.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status").notNull().default("online"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGuardLocationSchema = createInsertSchema(guardLocationsTable);
export type InsertGuardLocation = z.infer<typeof insertGuardLocationSchema>;
export type GuardLocation = typeof guardLocationsTable.$inferSelect;
