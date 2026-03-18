import { pgTable, serial, timestamp, text, varchar, integer, numeric, boolean, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统表
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 用户表
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    openid: varchar("openid", { length: 128 }).notNull().unique(),
    nickname: varchar("nickname", { length: 128 }),
    avatar: varchar("avatar", { length: 512 }),
    phone: varchar("phone", { length: 20 }),
    studentId: varchar("student_id", { length: 32 }),
    realName: varchar("real_name", { length: 64 }),
    balance: numeric("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
    rating: numeric("rating", { precision: 3, scale: 2 }).default("5.00").notNull(),
    totalOrders: integer("total_orders").default(0).notNull(),
    completedOrders: integer("completed_orders").default(0).notNull(),
    location: jsonb("location"), // { latitude, longitude, address }
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("users_openid_idx").on(table.openid),
    index("students_idx").on(table.studentId),
  ]
);

// 订单表
export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    publisherId: varchar("publisher_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    accepterId: varchar("accepter_id", { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    type: varchar("type", { length: 32 }).notNull(), // delivery_pickup, delivery_food, errand, etc.
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description").notNull(),
    pickupLocation: jsonb("pickup_location").notNull(), // { latitude, longitude, address }
    deliveryLocation: jsonb("delivery_location").notNull(), // { latitude, longitude, address }
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending, accepted, in_progress, completed, cancelled
    deadline: timestamp("deadline", { withTimezone: true, mode: 'string' }),
    pickupTime: timestamp("pickup_time", { withTimezone: true, mode: 'string' }),
    deliveryTime: timestamp("delivery_time", { withTimezone: true, mode: 'string' }),
    images: jsonb("images"), // Array of image URLs
    paymentStatus: varchar("payment_status", { length: 32 }).notNull().default("unpaid"), // unpaid, paid, refunded
    transactionId: varchar("transaction_id", { length: 128 }), // 微信支付交易号
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("orders_publisher_idx").on(table.publisherId),
    index("orders_accepter_idx").on(table.accepterId),
    index("orders_status_idx").on(table.status),
    index("orders_created_idx").on(table.createdAt),
  ]
);

// 订单评价表
export const orderReviews = pgTable(
  "order_reviews",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: 'cascade' }),
    reviewerId: varchar("reviewer_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    revieweeId: varchar("reviewee_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    rating: integer("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("order_reviews_order_idx").on(table.orderId),
    index("order_reviews_reviewer_idx").on(table.reviewerId),
    index("order_reviews_reviewee_idx").on(table.revieweeId),
  ]
);

// Zod schemas for validation
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

export const insertUserSchema = createCoercedInsertSchema(users).pick({
  openid: true,
  nickname: true,
  avatar: true,
  phone: true,
  studentId: true,
  realName: true,
  location: true,
});

export const updateUserSchema = createCoercedInsertSchema(users)
  .pick({
    nickname: true,
    avatar: true,
    phone: true,
    studentId: true,
    realName: true,
    location: true,
    isActive: true,
  })
  .partial();

export const insertOrderSchema = createCoercedInsertSchema(orders).pick({
  publisherId: true,
  type: true,
  title: true,
  description: true,
  pickupLocation: true,
  deliveryLocation: true,
  price: true,
  deadline: true,
  pickupTime: true,
  images: true,
});

export const updateOrderSchema = createCoercedInsertSchema(orders)
  .pick({
    accepterId: true,
    status: true,
    deadline: true,
    pickupTime: true,
    deliveryTime: true,
    paymentStatus: true,
    transactionId: true,
  })
  .partial();

export const insertOrderReviewSchema = createCoercedInsertSchema(orderReviews).pick({
  orderId: true,
  reviewerId: true,
  revieweeId: true,
  rating: true,
  comment: true,
});

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;

export type OrderReview = typeof orderReviews.$inferSelect;
export type InsertOrderReview = z.infer<typeof insertOrderReviewSchema>;
