import { Collection } from '@mikro-orm/core'
import {
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy'

@Entity({ tableName: 'construction_projects' })
@Index({ name: 'construction_projects_status_idx', properties: ['organizationId', 'tenantId', 'status', 'createdAt'] })
@Index({ name: 'construction_projects_owner_idx', properties: ['organizationId', 'tenantId', 'ownerUserId', 'status'] })
@Unique({ name: 'construction_projects_code_unique', properties: ['organizationId', 'tenantId', 'projectCode'] })
export class ConstructionProject {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'project_code', type: 'text' })
  projectCode!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ name: 'project_type', type: 'text', nullable: true })
  projectType?: string | null

  @Property({ type: 'text', default: 'draft' })
  status: string = 'draft'

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'site_address', type: 'text', nullable: true })
  siteAddress?: string | null

  @Property({ name: 'site_city', type: 'text', nullable: true })
  siteCity?: string | null

  @Property({ name: 'site_postal_code', type: 'text', nullable: true })
  sitePostalCode?: string | null

  @Property({ name: 'site_country_code', type: 'text', nullable: true })
  siteCountryCode?: string | null

  @Property({ name: 'site_latitude', type: 'text', nullable: true })
  siteLatitude?: string | null

  @Property({ name: 'site_longitude', type: 'text', nullable: true })
  siteLongitude?: string | null

  @Property({ name: 'client_company_id', type: 'uuid', nullable: true })
  clientCompanyId?: string | null

  @Property({ name: 'client_person_id', type: 'uuid', nullable: true })
  clientPersonId?: string | null

  @Property({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null

  @Property({ name: 'planned_start_date', type: Date, nullable: true })
  plannedStartDate?: Date | null

  @Property({ name: 'planned_end_date', type: Date, nullable: true })
  plannedEndDate?: Date | null

  @Property({ name: 'actual_start_date', type: Date, nullable: true })
  actualStartDate?: Date | null

  @Property({ name: 'actual_end_date', type: Date, nullable: true })
  actualEndDate?: Date | null

  @Property({ name: 'estimated_revenue_amount', type: 'numeric', precision: 19, scale: 4, nullable: true })
  estimatedRevenueAmount?: string | null

  @Property({ name: 'latest_approved_estimate_id', type: 'uuid', nullable: true })
  latestApprovedEstimateId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null

  @OneToMany(() => ConstructionProjectDeal, (link) => link.project)
  dealLinks = new Collection<ConstructionProjectDeal>(this)

  @OneToMany(() => CostEstimate, (estimate) => estimate.project)
  estimates = new Collection<CostEstimate>(this)

  @OneToMany(() => ConstructionProjectLoss, (loss) => loss.project)
  losses = new Collection<ConstructionProjectLoss>(this)
}

@Entity({ tableName: 'construction_project_deals' })
@Index({ name: 'construction_project_deals_project_linked_idx', properties: ['organizationId', 'tenantId', 'project', 'linkedAt'] })
@Unique({ name: 'construction_project_deals_project_deal_unique', properties: ['organizationId', 'tenantId', 'project', 'dealId'] })
@Unique({ name: 'construction_project_deals_deal_unique', properties: ['organizationId', 'tenantId', 'dealId'] })
export class ConstructionProjectDeal {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => ConstructionProject, { fieldName: 'construction_project_id', deleteRule: 'cascade' })
  project!: ConstructionProject

  @Property({ name: 'deal_id', type: 'uuid' })
  dealId!: string

  @Property({ type: 'text' })
  role!: string

  @Property({ name: 'linked_by_user_id', type: 'uuid', nullable: true })
  linkedByUserId?: string | null

  @Property({ name: 'linked_at', type: Date, onCreate: () => new Date() })
  linkedAt: Date = new Date()

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'cost_estimates' })
@Index({ name: 'cost_estimates_project_status_idx', properties: ['organizationId', 'tenantId', 'project', 'status', 'updatedAt'] })
@Index({ name: 'cost_estimates_approved_idx', properties: ['organizationId', 'tenantId', 'approvedAt'] })
@Unique({ name: 'cost_estimates_version_unique', properties: ['organizationId', 'tenantId', 'project', 'versionNo'] })
export class CostEstimate {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => ConstructionProject, { fieldName: 'construction_project_id', deleteRule: 'cascade' })
  project!: ConstructionProject

  @Property({ name: 'version_no', type: 'int' })
  versionNo!: number

  @Property({ type: 'int', default: 0 })
  revision: number = 0

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', default: 'draft' })
  status: string = 'draft'

  @Property({ name: 'currency_code', type: 'text' })
  currencyCode!: string

  @Property({ name: 'default_markup_percent', type: 'numeric', precision: 9, scale: 4, nullable: true })
  defaultMarkupPercent?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'total_cost_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  totalCostAmount: string = '0.0000'

  @Property({ name: 'total_sale_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  totalSaleAmount: string = '0.0000'

  @Property({ name: 'margin_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  marginAmount: string = '0.0000'

  @Property({ name: 'margin_percent', type: 'numeric', precision: 9, scale: 4, default: '0' })
  marginPercent: string = '0.0000'

  @Property({ name: 'source_estimate_id', type: 'uuid', nullable: true })
  sourceEstimateId?: string | null

  @Property({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId?: string | null

  @Property({ name: 'approved_at', type: Date, nullable: true })
  approvedAt?: Date | null

  @Property({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'archived_at', type: Date, nullable: true })
  archivedAt?: Date | null

  @OneToMany(() => CostLineItem, (lineItem) => lineItem.estimate)
  lineItems = new Collection<CostLineItem>(this)
}

@Entity({ tableName: 'cost_line_items' })
@Index({ name: 'cost_line_items_estimate_sort_idx', properties: ['organizationId', 'tenantId', 'estimate', 'sortOrder'] })
export class CostLineItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => CostEstimate, { fieldName: 'cost_estimate_id', deleteRule: 'cascade' })
  estimate!: CostEstimate

  @Property({ name: 'sort_order', type: 'int' })
  sortOrder!: number

  @Property({ type: 'text' })
  category!: string

  @Property({ type: 'text' })
  description!: string

  @Property({ type: 'text' })
  unit!: string

  @Property({ type: 'numeric', precision: 19, scale: 4 })
  quantity!: string

  @Property({ name: 'unit_cost_amount', type: 'numeric', precision: 19, scale: 4 })
  unitCostAmount!: string

  @Property({ name: 'markup_percent', type: 'numeric', precision: 9, scale: 4, nullable: true })
  markupPercent?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'total_cost_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  totalCostAmount: string = '0.0000'

  @Property({ name: 'total_sale_amount', type: 'numeric', precision: 19, scale: 4, default: '0' })
  totalSaleAmount: string = '0.0000'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'construction_project_losses' })
@Index({ name: 'construction_project_losses_project_idx', properties: ['organizationId', 'tenantId', 'project', 'recordedAt'] })
@Index({ name: 'construction_project_losses_reason_idx', properties: ['organizationId', 'tenantId', 'reasonCode', 'recordedAt'] })
export class ConstructionProjectLoss {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => ConstructionProject, { fieldName: 'construction_project_id', deleteRule: 'cascade' })
  project!: ConstructionProject

  @Property({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId?: string | null

  @Property({ name: 'reason_code', type: 'text' })
  reasonCode!: string

  @Property({ name: 'reason_details', type: 'text' })
  reasonDetails!: string

  @Property({ name: 'competitor_name', type: 'text', nullable: true })
  competitorName?: string | null

  @Property({ name: 'recorded_by_user_id', type: 'uuid', nullable: true })
  recordedByUserId?: string | null

  @Property({ name: 'recorded_at', type: Date, onCreate: () => new Date() })
  recordedAt: Date = new Date()

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}