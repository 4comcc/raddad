import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const conversationMode = pgEnum("conversation_mode", ["BOT", "HUMAN"]);
export const messageRole = pgEnum("message_role", ["CUSTOMER", "BOT", "AGENT", "SYSTEM"]);
export const leadKind = pgEnum("lead_kind", ["ORDER", "BOOKING", "INQUIRY"]);
export const leadStatus = pgEnum("lead_status", ["NEW", "DONE", "CANCELLED"]);

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const now = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();

export const businesses = pgTable("businesses", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  template: text("template").notNull().default("general"),
  // Knowledge the assistant answers from
  description: text("description").notNull().default(""),
  hours: text("hours").notNull().default(""),
  location: text("location").notNull().default(""),
  catalog: text("catalog").notNull().default(""),
  faqs: text("faqs").notNull().default(""),
  policies: text("policies").notNull().default(""),
  tone: text("tone").notNull().default("ودود ومختصر، بلهجة العميل"),
  extraInstructions: text("extra_instructions").notNull().default(""),
  handoffKeywords: text("handoff_keywords").notNull().default("موظف,شكوى,مدير,human,agent"),
  // WhatsApp Cloud API
  waPhoneNumberId: text("wa_phone_number_id").unique(),
  waAccessToken: text("wa_access_token"),
  botEnabled: boolean("bot_enabled").notNull().default(true),
  // WooCommerce REST API (read-only keys are enough)
  wooUrl: text("woo_url"),
  wooConsumerKey: text("woo_consumer_key"),
  wooConsumerSecret: text("woo_consumer_secret"),
  // Client dashboard access (scrypt hash)
  passwordHash: text("password_hash"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at").$onUpdate(() => new Date()),
});

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerPhone: text("customer_phone").notNull(),
    customerName: text("customer_name"),
    mode: conversationMode("mode").notNull().default("BOT"),
    needsAttention: boolean("needs_attention").notNull().default(false),
    attentionNote: text("attention_note"),
    isSimulator: boolean("is_simulator").notNull().default(false),
    lastMessageAt: now("last_message_at"),
    lastCustomerAt: timestamp("last_customer_at", { withTimezone: true }),
    createdAt: now("created_at"),
  },
  (t) => [
    uniqueIndex("conv_business_phone").on(t.businessId, t.customerPhone),
    index("conv_business_last").on(t.businessId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    text: text("text").notNull(),
    waMessageId: text("wa_message_id").unique(),
    mediaUrl: text("media_url"),
    error: text("error"),
    createdAt: now("created_at"),
  },
  (t) => [index("msg_conv_created").on(t.conversationId, t.createdAt)],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    kind: leadKind("kind").notNull(),
    details: text("details").notNull(),
    status: leadStatus("status").notNull().default("NEW"),
    createdAt: now("created_at"),
  },
  (t) => [index("lead_business_created").on(t.businessId, t.createdAt)],
);

export const businessRelations = relations(businesses, ({ many }) => ({
  conversations: many(conversations),
  leads: many(leads),
}));

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  business: one(businesses, { fields: [conversations.businessId], references: [businesses.id] }),
  messages: many(messages),
  leads: many(leads),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const leadRelations = relations(leads, ({ one }) => ({
  business: one(businesses, { fields: [leads.businessId], references: [businesses.id] }),
  conversation: one(conversations, { fields: [leads.conversationId], references: [conversations.id] }),
}));

export type Business = typeof businesses.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Lead = typeof leads.$inferSelect;
