/**
 * plotPositions.ts
 * Farm plot tile coordinates. x/y are tile units on the Phaser map (1 tile = 16 px).
 * fieldIndex maps to FIELD_LEVEL_REQUIREMENTS in experience.ts for unlock state.
 */

export interface PlotPositionDef {
  id: string
  fieldIndex: number
  x: number
  y: number
}

export const PLOT_POSITIONS: PlotPositionDef[] = [
  // ── Zone A ──────────────────────────────────────────────────
  { id: 'plot_01', fieldIndex: 0, x: 16, y: 5 },
  { id: 'plot_02', fieldIndex: 1, x: 17, y: 5 },
  { id: 'plot_03', fieldIndex: 2, x: 18, y: 5 },
  { id: 'plot_04', fieldIndex: 3, x: 19, y: 5 },
  { id: 'plot_05', fieldIndex: 4, x: 20, y: 5 },
  { id: 'plot_06', fieldIndex: 5, x: 21, y: 5 },

  { id: 'plot_07', fieldIndex: 6, x: 16, y: 6 },
  { id: 'plot_08', fieldIndex: 7, x: 17, y: 6 },
  { id: 'plot_09', fieldIndex: 8, x: 18, y: 6 },
  { id: 'plot_10', fieldIndex: 9, x: 19, y: 6 },
  { id: 'plot_11', fieldIndex: 10, x: 20, y: 6 },
  { id: 'plot_12', fieldIndex: 11, x: 21, y: 6 },

  { id: 'plot_13', fieldIndex: 12, x: 16, y: 7 },
  { id: 'plot_14', fieldIndex: 13, x: 17, y: 7 },
  { id: 'plot_15', fieldIndex: 14, x: 18, y: 7 },
  { id: 'plot_16', fieldIndex: 15, x: 19, y: 7 },
  { id: 'plot_17', fieldIndex: 16, x: 20, y: 7 },
  { id: 'plot_18', fieldIndex: 17, x: 21, y: 7 },

  { id: 'plot_19', fieldIndex: 18, x: 16, y: 8 },
  { id: 'plot_20', fieldIndex: 19, x: 17, y: 8 },
  { id: 'plot_21', fieldIndex: 20, x: 18, y: 8 },
  { id: 'plot_22', fieldIndex: 21, x: 19, y: 8 },
  { id: 'plot_23', fieldIndex: 22, x: 20, y: 8 },
  { id: 'plot_24', fieldIndex: 23, x: 21, y: 8 },

  // ── Zone B ──────────────────────────────────────────────────

  { id: 'plot_25', fieldIndex: 24, x: 8, y: 13 },
  { id: 'plot_26', fieldIndex: 25, x: 9, y: 13 },
  { id: 'plot_27', fieldIndex: 26, x: 10, y: 13 },
  { id: 'plot_28', fieldIndex: 27, x: 11, y: 13 },
  { id: 'plot_29', fieldIndex: 28, x: 12, y: 13 },
  { id: 'plot_30', fieldIndex: 29, x: 13, y: 13 },

  { id: 'plot_31', fieldIndex: 30, x: 8, y: 14 },
  { id: 'plot_32', fieldIndex: 31, x: 9, y: 14 },
  { id: 'plot_33', fieldIndex: 32, x: 10, y: 14 },
  { id: 'plot_34', fieldIndex: 33, x: 11, y: 14 },
  { id: 'plot_35', fieldIndex: 34, x: 12, y: 14 },
  { id: 'plot_36', fieldIndex: 35, x: 13, y: 14 },

  { id: 'plot_37', fieldIndex: 36, x: 8, y: 15 },
  { id: 'plot_38', fieldIndex: 37, x: 9, y: 15 },
  { id: 'plot_39', fieldIndex: 38, x: 10, y: 15 },
  { id: 'plot_40', fieldIndex: 39, x: 11, y: 15 },
  { id: 'plot_41', fieldIndex: 40, x: 12, y: 15 },
  { id: 'plot_42', fieldIndex: 41, x: 13, y: 15 },

  { id: 'plot_43', fieldIndex: 42, x: 8, y: 16 },
  { id: 'plot_44', fieldIndex: 43, x: 9, y: 16 },
  { id: 'plot_45', fieldIndex: 44, x: 10, y: 16 },
  { id: 'plot_46', fieldIndex: 45, x: 11, y: 16 },
  { id: 'plot_47', fieldIndex: 46, x: 12, y: 16 },
  { id: 'plot_48', fieldIndex: 47, x: 13, y: 16 },

  // ── Zone C ──────────────────────────────────────────────────

  { id: 'plot_49', fieldIndex: 48, x: 39, y: 4 },
  { id: 'plot_50', fieldIndex: 49, x: 40, y: 4 },
  { id: 'plot_51', fieldIndex: 50, x: 41, y: 4 },
  { id: 'plot_52', fieldIndex: 51, x: 42, y: 4 },
  { id: 'plot_53', fieldIndex: 52, x: 43, y: 4 },
  { id: 'plot_54', fieldIndex: 53, x: 44, y: 4 },

  { id: 'plot_55', fieldIndex: 54, x: 39, y: 5 },
  { id: 'plot_56', fieldIndex: 55, x: 40, y: 5 },
  { id: 'plot_57', fieldIndex: 56, x: 41, y: 5 },
  { id: 'plot_58', fieldIndex: 57, x: 42, y: 5 },
  { id: 'plot_59', fieldIndex: 58, x: 43, y: 5 },
  { id: 'plot_60', fieldIndex: 59, x: 44, y: 5 },

  { id: 'plot_61', fieldIndex: 60, x: 39, y: 6 },
  { id: 'plot_62', fieldIndex: 61, x: 40, y: 6 },
  { id: 'plot_63', fieldIndex: 62, x: 41, y: 6 },
  { id: 'plot_64', fieldIndex: 63, x: 42, y: 6 },
  { id: 'plot_65', fieldIndex: 64, x: 43, y: 6 },
  { id: 'plot_66', fieldIndex: 65, x: 44, y: 6 },

  { id: 'plot_67', fieldIndex: 66, x: 39, y: 7 },
  { id: 'plot_68', fieldIndex: 67, x: 40, y: 7 },
  { id: 'plot_69', fieldIndex: 68, x: 41, y: 7 },
  { id: 'plot_70', fieldIndex: 69, x: 42, y: 7 },
  { id: 'plot_71', fieldIndex: 70, x: 43, y: 7 },
  { id: 'plot_72', fieldIndex: 71, x: 44, y: 7 },
]
