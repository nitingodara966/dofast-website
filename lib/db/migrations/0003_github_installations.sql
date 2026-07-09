CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"repository_selection" text,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_installations_user_id_idx" ON "github_installations" USING btree ("user_id");