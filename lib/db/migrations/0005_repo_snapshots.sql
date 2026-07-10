CREATE TABLE "repo_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"ref" text NOT NULL,
	"status" text NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"total_size" bigint DEFAULT 0 NOT NULL,
	"file_index" jsonb NOT NULL,
	"refresh_error" text,
	"refresh_failed_at" timestamp with time zone,
	"indexed_at" timestamp with time zone NOT NULL,
	"head_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repo_snapshots_status_check" CHECK ("repo_snapshots"."status" in ('ready', 'truncated', 'failed')),
	CONSTRAINT "repo_snapshots_file_count_check" CHECK ("repo_snapshots"."file_count" >= 0),
	CONSTRAINT "repo_snapshots_skipped_count_check" CHECK ("repo_snapshots"."skipped_count" >= 0),
	CONSTRAINT "repo_snapshots_total_size_check" CHECK ("repo_snapshots"."total_size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "repo_snapshots" ADD CONSTRAINT "repo_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repo_snapshots_site_id_unique" ON "repo_snapshots" USING btree ("site_id");