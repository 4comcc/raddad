CREATE TYPE "public"."conversation_mode" AS ENUM('BOT', 'HUMAN');--> statement-breakpoint
CREATE TYPE "public"."lead_kind" AS ENUM('ORDER', 'BOOKING', 'INQUIRY');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('NEW', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('CUSTOMER', 'BOT', 'AGENT', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"template" text DEFAULT 'general' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hours" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"catalog" text DEFAULT '' NOT NULL,
	"faqs" text DEFAULT '' NOT NULL,
	"policies" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT 'ودود ومختصر، بلهجة العميل' NOT NULL,
	"extra_instructions" text DEFAULT '' NOT NULL,
	"handoff_keywords" text DEFAULT 'موظف,شكوى,مدير,human,agent' NOT NULL,
	"wa_phone_number_id" text,
	"wa_access_token" text,
	"bot_enabled" boolean DEFAULT true NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "businesses_wa_phone_number_id_unique" UNIQUE("wa_phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_name" text,
	"mode" "conversation_mode" DEFAULT 'BOT' NOT NULL,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"attention_note" text,
	"is_simulator" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_customer_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"kind" "lead_kind" NOT NULL,
	"details" text NOT NULL,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"text" text NOT NULL,
	"wa_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_wa_message_id_unique" UNIQUE("wa_message_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conv_business_phone" ON "conversations" USING btree ("business_id","customer_phone");--> statement-breakpoint
CREATE INDEX "conv_business_last" ON "conversations" USING btree ("business_id","last_message_at");--> statement-breakpoint
CREATE INDEX "lead_business_created" ON "leads" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "msg_conv_created" ON "messages" USING btree ("conversation_id","created_at");