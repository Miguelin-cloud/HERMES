import { GrainValidationChecks } from './types';

export function getGrainShapeLabel(shape: number, t?: any): string {
  switch (shape) {
    case 1:
      return t?.shape_cylindrical || 'Cilíndrico';
    case 2:
      return t?.shape_star || 'Estrella';
    case 3:
      return t?.shape_solid || 'Macizo';
    case 4:
      return t?.shape_finocyl || 'Finocyl';
    case 5:
      return t?.shape_moonburner || 'Moonburner';
    case 6:
      return t?.shape_cslot || 'C-Slot';
    case 7:
      return t?.shape_dgrain || 'D-Grain';
    case 8:
      return t?.shape_rodtube || 'Rod & Tube';
    case 9:
      return t?.shape_wagonwheel || 'Wagon Wheel';
    default:
      return t?.shape_cylindrical || 'BATES';
  }
}

export function getGrainShapeDesc(shape: number, t?: any): string {
  switch (shape) {
    case 1:
      return t?.shape_cylindrical_desc || 'Central tubular core';
    case 2:
      return t?.shape_star_desc || 'Star core configuration';
    case 3:
      return t?.shape_solid_desc || 'No core, external burn only';
    case 4:
      return t?.shape_finocyl_desc || 'Tubular core with full-length radial fins';
    case 5:
      return t?.shape_moonburner_desc || 'Eccentric circular core';
    case 6:
      return t?.shape_cslot_desc || 'Radial lateral slot open to perimeter';
    case 7:
      return t?.shape_dgrain_desc || 'Chordal flat-cut grain';
    case 8:
      return t?.shape_rodtube_desc || 'Concentric inner rod + outer tube';
    case 9:
      return t?.shape_wagonwheel_desc || 'Central core + radial propellant spokes';
    default:
      return '';
  }
}

export function getGeometryErrorMessage(
  checks: Pick<GrainValidationChecks, 'geometryErrorCode' | 'geometryErrorLimitMm'> | undefined,
  t?: any
): string | null {
  if (!checks?.geometryErrorCode) return null;
  const code = checks.geometryErrorCode;
  const lim = checks.geometryErrorLimitMm;
  const limStr = lim !== undefined ? `${lim.toFixed(1)} mm` : '';

  switch (code) {
    case 'finocyl_min_fins':
      return t?.geom_err_finocyl_min_fins || 'Finocyl requires at least 2 fins';
    case 'finocyl_tip_lte_d0':
      return t?.geom_err_finocyl_tip_lte_d0 || 'Fin tip diameter must exceed core d0';
    case 'finocyl_tip_gte_D0':
      return t?.geom_err_finocyl_tip_gte_D0 || 'Fin tip diameter must be < D0';
    case 'finocyl_width_gt0':
      return t?.geom_err_finocyl_width_gt0 || 'Fin width must be > 0';
    case 'finocyl_width_overlap':
      return `${t?.geom_err_finocyl_width_overlap || 'Fin width overlaps adjacent fins (max'} ${limStr})`;
    case 'moonburner_offset_negative':
      return t?.geom_err_moonburner_offset_negative || 'Core offset must be ≥ 0';
    case 'moonburner_offset_exceeds':
      return `${t?.geom_err_moonburner_offset_exceeds || 'Offset breaks outer wall (max'} ${limStr})`;
    case 'cslot_width_gt0':
      return t?.geom_err_cslot_width_gt0 || 'Slot width must be > 0';
    case 'cslot_width_gte_D0':
      return t?.geom_err_cslot_width_gte_D0 || 'Slot width must be < D0';
    case 'cslot_depth_gt0':
      return t?.geom_err_cslot_depth_gt0 || 'Slot depth must be > 0';
    case 'cslot_depth_splits_grain':
      return `${t?.geom_err_cslot_depth_splits_grain || 'Slot splits the grain in two (max'} ${limStr})`;
    case 'dgrain_cut_gt0':
      return t?.geom_err_dgrain_cut_gt0 || 'Cut depth must be > 0';
    case 'dgrain_cut_gte_D0':
      return t?.geom_err_dgrain_cut_gte_D0 || 'Cut depth must be < D0';
    case 'rodtube_rod_gt0':
      return t?.geom_err_rodtube_rod_gt0 || 'Center rod diameter must be > 0';
    case 'rodtube_rod_gte_d0':
      return t?.geom_err_rodtube_rod_gte_d0 || 'Rod diameter must be < Tube ID (d0)';
    case 'wagon_min_spokes':
      return t?.geom_err_wagon_min_spokes || 'Wagon Wheel requires at least 3 spokes';
    case 'wagon_outer_lte_d0':
      return t?.geom_err_wagon_outer_lte_d0 || 'Window outer diameter must exceed core d0';
    case 'wagon_outer_gte_D0':
      return t?.geom_err_wagon_outer_gte_D0 || 'Window outer diameter must be < D0';
    case 'wagon_spoke_gt0':
      return t?.geom_err_wagon_spoke_gt0 || 'Spoke thickness must be > 0';
    case 'wagon_spoke_overlap':
      return `${t?.geom_err_wagon_spoke_overlap || 'Spoke thickness overlaps at core (max'} ${limStr})`;
    default:
      return code;
  }
}
