/**
 * View registry. Maps a route id to its renderer.
 *
 * Anything not registered here falls through to the generic analytical page,
 * which is driven entirely by that view's entry in nav.js — so a new
 * analytical view needs a nav entry and nothing else.
 */
import { renderAnalytical } from './analytical.js';
import { renderAbout } from './about.js';
import { renderKnowledgeCenter } from './knowledge-center.js';
import { renderBoardroom } from './boardroom.js';
import { renderAccessControl } from './access-control.js';
import { renderHoursPerEmployee } from './hours-per-employee.js';
import { renderHoursCoverage } from './hours-coverage.js';
import { renderEvidenceExceptions } from './evidence-exceptions.js';
import { renderRevenueConcentration } from './revenue-concentration.js';
import { renderRegionalActuals } from './regional-actuals.js';

const REGISTRY = {
  about: renderAbout,
  'knowledge-center': renderKnowledgeCenter,
  boardroom: renderBoardroom,
  'access-control': renderAccessControl,
  'hours-per-employee': renderHoursPerEmployee,
  'hours-coverage': renderHoursCoverage,
  'evidence-exceptions': renderEvidenceExceptions,
  'revenue-concentration': renderRevenueConcentration,
  'regional-actuals': renderRegionalActuals,
};

/** Shared across renders so a segmented control keeps its choice on repaint. */
const uiState = {};

export function renderView(root, view) {
  const render = REGISTRY[view.id];
  if (render) return render(root, view);
  return renderAnalytical(root, view, uiState);
}
