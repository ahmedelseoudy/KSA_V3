import { buildBatchLifecycleTrack } from './model';
import type { BatchLifecycle, LifecycleDensity, LifecycleTrackModel } from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function warningHtml(track: LifecycleTrackModel): string {
  if (!track.warning) return '';
  return `<span class="lc-warning lc-warning--${track.warning.tone}">${escapeHtml(track.warning.label)}</span>`;
}

function compactTrack(track: LifecycleTrackModel): string {
  return `
    <div class="lc-track lc-track--compact" role="img" aria-label="${escapeHtml(track.ariaLabel)}">
      <ol class="lc-steps" aria-hidden="true">
        ${track.steps.map((step) => `
          <li class="lc-step lc-step--${step.state}">
            <span class="lc-dot"></span>
          </li>
        `).join('')}
      </ol>
      <span class="lc-summary">${escapeHtml(track.stageLabel)} · ${escapeHtml(track.activityLabel)}</span>
      ${warningHtml(track)}
    </div>
  `;
}

function expandedTrack(track: LifecycleTrackModel, density: 'row' | 'detail'): string {
  return `
    <div class="lc-track lc-track--${density}" role="group" aria-label="${escapeHtml(track.ariaLabel)}">
      <div class="lc-heading">
        <span class="lc-summary">${escapeHtml(track.stageLabel)} · ${escapeHtml(track.activityLabel)}</span>
        ${warningHtml(track)}
      </div>
      <ol class="lc-steps">
        ${track.steps.map((step) => `
          <li class="lc-step lc-step--${step.state}">
            <span class="lc-dot" aria-hidden="true"></span>
            <span class="lc-step-label">${escapeHtml(step.label)}</span>
            <span class="lc-step-date">${escapeHtml(step.date || '—')}</span>
            <span class="lc-step-metric">${escapeHtml(step.metric)}</span>
          </li>
        `).join('')}
      </ol>
      <p class="lc-next"><span>Next:</span> ${escapeHtml(track.nextAction)}</p>
    </div>
  `;
}

export function renderLifecycleTrack(
  batch: BatchLifecycle,
  density: LifecycleDensity = 'compact'
): string {
  const track = buildBatchLifecycleTrack(batch);
  return density === 'compact'
    ? compactTrack(track)
    : expandedTrack(track, density);
}
