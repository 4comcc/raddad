CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"conversation_id" text,
	"number" integer NOT NULL,
	"token" text NOT NULL,
	"format" text NOT NULL,
	"customer_name" text,
	"data" jsonb NOT NULL,
	"total" double precision NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"file" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quotes_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_currency" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_tax_rate" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_valid_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "quote_terms" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_business_number" ON "quotes" USING btree ("business_id","number");