import { pgTable, text, serial, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const panicAlertsTable = pgTable("panic_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status").notNull().default("active"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertPanicAlertSchema = createInsertSchema(panicAlertsTable).omit({ id: true, createdAt: true });
export type InsertPanicAlert = z.infer<typeof insertPanicAlertSchema>;
export type PanicAlert = typeof panicAlertsTable.$inferSelect;
