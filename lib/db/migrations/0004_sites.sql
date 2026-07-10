CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" bigint NOT NULL,
	"repo_id" bigint NOT NULL,
	"repo_full_name" text NOT NULL,
	"default_branch" text NOT NULL,
	"framework" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_installation_id_github_installations_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("installation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sites_user_repo_unique" ON "sites" USING btree ("user_id","repo_id");--> statement-breakpoint
CREATE INDEX "sites_user_id_idx" ON "sites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sites_installation_id_idx" ON "sites" USING btree ("installation_id");