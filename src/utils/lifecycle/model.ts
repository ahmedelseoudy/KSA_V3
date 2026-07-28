import type {
  BatchLifecycle,
  BatchLifecycleStage,
  LifecycleStep,
  LifecycleStepState,
  LifecycleTrackModel,
  LifecycleWarning,
} from './types';

const STAGE_LABELS: Record<BatchLifecycleStage, string> = {
  created: 'Created',
  availability_sent: 'Availability sent',
  responses_ready: 'Responses ready',
  po_sent: 'POs sent',
  partially_delivered: 'Partially delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function activityLabel(value: string | null | undefined): string {
  if (!value) return 'No activity yet';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'No activity yet';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'active today';
  if (days === 1) return 'active 1d ago';
  return `active ${days}d ago`;
}

function warningFor(batch: BatchLifecycle): LifecycleWarning | null {
  const overdue = number(batch.overdue_count);
  if (overdue > 0) {
    return {
      tone: 'danger',
      label: `${overdue} overdue ${overdue === 1 ? 'delivery' : 'deliveries'}`,
    };
  }

  const awaiting = number(batch.awaiting_confirmation_count);
  if (awaiting > 0) {
    return {
      tone: 'warning',
      label: `${awaiting} awaiting confirmation`,
    };
  }

  const silent = number(batch.silent_companies);
  if (silent > 0) {
    return {
      tone: 'info',
      label: `${silent} ${silent === 1 ? 'company' : 'companies'} silent`,
    };
  }

  return null;
}

function stepState(
  batch: BatchLifecycle,
  reached: boolean,
  current: boolean
): LifecycleStepState {
  if (batch.lifecycle_stage === 'cancelled') return current ? 'cancelled' : (reached ? 'complete' : 'upcoming');
  if (current) return 'current';
  return reached ? 'complete' : 'upcoming';
}

export function buildBatchLifecycleTrack(batch: BatchLifecycle): LifecycleTrackModel {
  const companies = number(batch.companies_count);
  const answered = number(batch.responded_companies) + number(batch.partial_companies);
  const purchaseOrders = number(batch.purchase_order_count);
  const delivered = number(batch.delivered_count);
  const stage = batch.lifecycle_stage || 'created';

  const availabilityReached = Boolean(batch.availability_sent_at) || companies > 0;
  const answersReached = Boolean(batch.first_response_at) || answered > 0;
  const poReached = Boolean(batch.first_purchase_order_sent_at) || purchaseOrders > 0;
  const deliveryReached = Boolean(batch.first_delivery_at) || number(batch.delivered_qty) > 0;
  const deliveryComplete = stage === 'completed' || (purchaseOrders > 0 && delivered >= purchaseOrders);
  const cancelledStep = stage === 'cancelled'
    ? deliveryReached ? 'delivery'
      : poReached ? 'purchase_orders'
        : answersReached ? 'answers'
          : availabilityReached ? 'availability'
            : 'created'
    : null;

  const steps: LifecycleStep[] = [
    {
      key: 'created',
      label: 'Created',
      date: shortDate(batch.created_at),
      metric: `${number(batch.total_items)} items`,
      state: stepState(batch, true, stage === 'created' || cancelledStep === 'created'),
    },
    {
      key: 'availability',
      label: 'Availability',
      date: shortDate(batch.availability_sent_at),
      metric: `${companies} asked`,
      state: stepState(
        batch,
        availabilityReached,
        stage === 'availability_sent' || cancelledStep === 'availability'
      ),
    },
    {
      key: 'answers',
      label: 'Answers',
      date: shortDate(batch.responses_completed_at || batch.last_response_at || batch.first_response_at),
      metric: `${answered}/${companies} answered`,
      state: stepState(
        batch,
        answersReached,
        stage === 'responses_ready' || cancelledStep === 'answers'
      ),
    },
    {
      key: 'purchase_orders',
      label: 'POs sent',
      date: shortDate(batch.last_purchase_order_sent_at || batch.first_purchase_order_sent_at),
      metric: `${purchaseOrders} POs`,
      state: stepState(
        batch,
        poReached,
        stage === 'po_sent' || cancelledStep === 'purchase_orders'
      ),
    },
    {
      key: 'delivery',
      label: 'Delivered',
      date: shortDate(batch.delivery_completed_at || batch.first_delivery_at),
      metric: `${delivered}/${purchaseOrders} delivered`,
      state: stepState(
        batch,
        deliveryReached || deliveryComplete,
        stage === 'partially_delivered' || stage === 'completed' || cancelledStep === 'delivery'
      ),
    },
  ];

  const stageLabel = STAGE_LABELS[stage] || STAGE_LABELS.created;
  const nextAction = batch.next_action || 'Review batch';
  const ariaSteps = steps
    .map((step) => `${step.label}: ${step.date || 'not reached'}, ${step.metric}`)
    .join('. ');

  return {
    stage,
    stageLabel,
    activityLabel: activityLabel(batch.last_activity_at),
    nextAction,
    warning: warningFor(batch),
    steps,
    ariaLabel: `${stageLabel}. ${ariaSteps}. Next action: ${nextAction}.`,
  };
}
