import type { OrderBatch } from '../../types/database';

export type LifecycleDensity = 'compact' | 'row' | 'detail';

export type BatchLifecycleStage =
  | 'created'
  | 'availability_sent'
  | 'responses_ready'
  | 'po_sent'
  | 'partially_delivered'
  | 'completed'
  | 'cancelled';

export type LifecycleStepState = 'complete' | 'current' | 'upcoming' | 'cancelled';

export interface BatchLifecycle extends OrderBatch {
  companies_count: number;
  responded_companies: number;
  partial_companies: number;
  silent_companies: number;
  purchase_order_count: number;
  awaiting_confirmation_count: number;
  ready_to_schedule_count: number;
  overdue_count: number;
  partially_delivered_count: number;
  delivered_count: number;
  requested_qty: number;
  available_qty: number;
  ordered_qty: number;
  delivered_qty: number;
  ordered_value: number;
  delivered_value: number;
  availability_sent_at: string | null;
  first_response_at: string | null;
  last_response_at: string | null;
  responses_completed_at: string | null;
  first_purchase_order_sent_at: string | null;
  last_purchase_order_sent_at: string | null;
  first_delivery_at: string | null;
  delivery_completed_at: string | null;
  last_activity_at: string;
  lifecycle_stage: BatchLifecycleStage;
  stage_index: number;
  next_action: string;
}

export interface LifecycleStep {
  key: 'created' | 'availability' | 'answers' | 'purchase_orders' | 'delivery';
  label: string;
  date: string | null;
  metric: string;
  state: LifecycleStepState;
}

export interface LifecycleWarning {
  tone: 'danger' | 'warning' | 'info';
  label: string;
}

export interface LifecycleTrackModel {
  stage: BatchLifecycleStage;
  stageLabel: string;
  activityLabel: string;
  nextAction: string;
  warning: LifecycleWarning | null;
  steps: LifecycleStep[];
  ariaLabel: string;
}
