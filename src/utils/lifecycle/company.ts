export interface CompanyLifecycleRow {
  batch_id: string;
  company_id: string;
  purchase_order_id: string | null;
  purchase_order_status: string | null;
  ordered_qty: number | string | null;
  delivered_qty: number | string | null;
  ordered_value: number | string | null;
  delivered_value: number | string | null;
  awaiting_confirmation: boolean;
  ready_to_schedule: boolean;
  is_overdue: boolean;
  lifecycle_stage: string;
}

export interface CompanyLifecycleSummary {
  companies: number;
  purchase_orders: number;
  awaiting_confirmation: number;
  ready_to_schedule: number;
  overdue: number;
  delivered: number;
  ordered_qty: number;
  delivered_qty: number;
  ordered_value: number;
  delivered_value: number;
  fill_rate: number;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeCompanyLifecycle(
  rows: CompanyLifecycleRow[]
): CompanyLifecycleSummary {
  const orderedQty = rows.reduce((sum, row) => sum + numeric(row.ordered_qty), 0);
  const deliveredQty = rows.reduce((sum, row) => sum + numeric(row.delivered_qty), 0);

  return {
    companies: rows.length,
    purchase_orders: rows.filter(
      (row) => row.purchase_order_id && row.purchase_order_status !== 'cancelled'
    ).length,
    awaiting_confirmation: rows.filter((row) => row.awaiting_confirmation).length,
    ready_to_schedule: rows.filter((row) => row.ready_to_schedule).length,
    overdue: rows.filter((row) => row.is_overdue).length,
    delivered: rows.filter((row) => row.lifecycle_stage === 'delivered').length,
    ordered_qty: orderedQty,
    delivered_qty: deliveredQty,
    ordered_value: rows.reduce((sum, row) => sum + numeric(row.ordered_value), 0),
    delivered_value: rows.reduce((sum, row) => sum + numeric(row.delivered_value), 0),
    fill_rate: orderedQty > 0 ? Math.min(100, (deliveredQty / orderedQty) * 100) : 0,
  };
}
