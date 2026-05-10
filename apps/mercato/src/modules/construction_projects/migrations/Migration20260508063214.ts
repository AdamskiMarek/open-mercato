import { Migration } from '@mikro-orm/migrations';

export class Migration20260508063214 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "construction_projects" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "project_code" text not null, "name" text not null, "project_type" text null, "status" text not null default 'draft', "description" text null, "notes" text null, "site_address" text null, "site_city" text null, "site_postal_code" text null, "site_country_code" text null, "site_latitude" text null, "site_longitude" text null, "client_company_id" uuid null, "client_person_id" uuid null, "owner_user_id" uuid null, "planned_start_date" timestamptz null, "planned_end_date" timestamptz null, "actual_start_date" timestamptz null, "actual_end_date" timestamptz null, "estimated_revenue_amount" numeric(19,4) null, "latest_approved_estimate_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "construction_projects_owner_idx" on "construction_projects" ("organization_id", "tenant_id", "owner_user_id", "status");`);
    this.addSql(`create index "construction_projects_status_idx" on "construction_projects" ("organization_id", "tenant_id", "status", "created_at");`);
    this.addSql(`alter table if exists "construction_projects" add constraint "construction_projects_code_unique" unique ("organization_id", "tenant_id", "project_code");`);

    this.addSql(`create table "construction_project_deals" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "construction_project_id" uuid not null, "deal_id" uuid not null, "role" text not null, "linked_by_user_id" uuid null, "linked_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "construction_project_deals_project_linked_idx" on "construction_project_deals" ("organization_id", "tenant_id", "construction_project_id", "linked_at");`);
    this.addSql(`alter table if exists "construction_project_deals" add constraint "construction_project_deals_deal_unique" unique ("organization_id", "tenant_id", "deal_id");`);
    this.addSql(`alter table if exists "construction_project_deals" add constraint "construction_project_deals_project_deal_unique" unique ("organization_id", "tenant_id", "construction_project_id", "deal_id");`);

    this.addSql(`create table "construction_project_losses" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "construction_project_id" uuid not null, "deal_id" uuid null, "reason_code" text not null, "reason_details" text not null, "competitor_name" text null, "recorded_by_user_id" uuid null, "recorded_at" timestamptz not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "construction_project_losses_reason_idx" on "construction_project_losses" ("organization_id", "tenant_id", "reason_code", "recorded_at");`);
    this.addSql(`create index "construction_project_losses_project_idx" on "construction_project_losses" ("organization_id", "tenant_id", "construction_project_id", "recorded_at");`);

    this.addSql(`create table "cost_estimates" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "construction_project_id" uuid not null, "version_no" int not null, "revision" int not null default 0, "name" text not null, "status" text not null default 'draft', "currency_code" text not null, "default_markup_percent" numeric(9,4) null, "notes" text null, "total_cost_amount" numeric(19,4) not null default '0', "total_sale_amount" numeric(19,4) not null default '0', "margin_amount" numeric(19,4) not null default '0', "margin_percent" numeric(9,4) not null default '0', "source_estimate_id" uuid null, "approved_by_user_id" uuid null, "approved_at" timestamptz null, "created_by_user_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "archived_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "cost_estimates_approved_idx" on "cost_estimates" ("organization_id", "tenant_id", "approved_at");`);
    this.addSql(`create index "cost_estimates_project_status_idx" on "cost_estimates" ("organization_id", "tenant_id", "construction_project_id", "status", "updated_at");`);
    this.addSql(`alter table if exists "cost_estimates" add constraint "cost_estimates_version_unique" unique ("organization_id", "tenant_id", "construction_project_id", "version_no");`);

    this.addSql(`create table "cost_line_items" ("id" uuid not null default gen_random_uuid(), "organization_id" uuid not null, "tenant_id" uuid not null, "cost_estimate_id" uuid not null, "sort_order" int not null, "category" text not null, "description" text not null, "unit" text not null, "quantity" numeric(19,4) not null, "unit_cost_amount" numeric(19,4) not null, "markup_percent" numeric(9,4) null, "notes" text null, "total_cost_amount" numeric(19,4) not null default '0', "total_sale_amount" numeric(19,4) not null default '0', "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, primary key ("id"));`);
    this.addSql(`create index "cost_line_items_estimate_sort_idx" on "cost_line_items" ("organization_id", "tenant_id", "cost_estimate_id", "sort_order");`);

    this.addSql(`alter table if exists "construction_project_deals" add constraint "construction_project_deals_construction_project_id_foreign" foreign key ("construction_project_id") references "construction_projects" ("id") on delete cascade;`);
    this.addSql(`alter table if exists "construction_project_losses" add constraint "construction_project_losses_construction_project_id_foreign" foreign key ("construction_project_id") references "construction_projects" ("id") on delete cascade;`);
    this.addSql(`alter table if exists "cost_estimates" add constraint "cost_estimates_construction_project_id_foreign" foreign key ("construction_project_id") references "construction_projects" ("id") on delete cascade;`);
    this.addSql(`alter table if exists "cost_line_items" add constraint "cost_line_items_cost_estimate_id_foreign" foreign key ("cost_estimate_id") references "cost_estimates" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table if exists "cost_line_items" drop constraint if exists "cost_line_items_cost_estimate_id_foreign";`);
    this.addSql(`alter table if exists "cost_estimates" drop constraint if exists "cost_estimates_construction_project_id_foreign";`);
    this.addSql(`alter table if exists "construction_project_losses" drop constraint if exists "construction_project_losses_construction_project_id_foreign";`);
    this.addSql(`alter table if exists "construction_project_deals" drop constraint if exists "construction_project_deals_construction_project_id_foreign";`);

    this.addSql(`drop table if exists "cost_line_items" cascade;`);
    this.addSql(`drop table if exists "cost_estimates" cascade;`);
    this.addSql(`drop table if exists "construction_project_losses" cascade;`);
    this.addSql(`drop table if exists "construction_project_deals" cascade;`);
    this.addSql(`drop table if exists "construction_projects" cascade;`);
  }

}
