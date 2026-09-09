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
  { id: 'plot_01', fieldIndex: 0,  x: 17, y: 11 },
  { id: 'plot_02', fieldIndex: 1,  x: 18, y: 11 },
  { id: 'plot_03', fieldIndex: 2,  x: 19, y: 11 },
  { id: 'plot_04', fieldIndex: 3,  x: 20, y: 11 },
  { id: 'plot_05', fieldIndex: 4,  x: 21, y: 11 },
  { id: 'plot_06', fieldIndex: 5,  x: 22, y: 11 },

  { id: 'plot_07', fieldIndex: 6,  x: 17, y: 12 },
  { id: 'plot_08', fieldIndex: 7,  x: 18, y: 12 },
  { id: 'plot_09', fieldIndex: 8,  x: 19, y: 12 },
  { id: 'plot_10', fieldIndex: 9,  x: 20, y: 12 },
  { id: 'plot_11', fieldIndex: 10, x: 21, y: 12 },
  { id: 'plot_12', fieldIndex: 11, x: 22, y: 12 },

  { id: 'plot_13', fieldIndex: 12, x: 17, y: 13 },
  { id: 'plot_14', fieldIndex: 13, x: 18, y: 13 },
  { id: 'plot_15', fieldIndex: 14, x: 19, y: 13 },
  { id: 'plot_16', fieldIndex: 15, x: 20, y: 13 },
  { id: 'plot_17', fieldIndex: 16, x: 21, y: 13 },
  { id: 'plot_18', fieldIndex: 17, x: 22, y: 13 },

  { id: 'plot_19', fieldIndex: 18, x: 17, y: 14 },
  { id: 'plot_20', fieldIndex: 19, x: 18, y: 14 },
  { id: 'plot_21', fieldIndex: 20, x: 19, y: 14 },
  { id: 'plot_22', fieldIndex: 21, x: 20, y: 14 },
  { id: 'plot_23', fieldIndex: 22, x: 21, y: 14 },
  { id: 'plot_24', fieldIndex: 23, x: 22, y: 14 },

  // ── Zone B ──────────────────────────────────────────────────
  { id: 'plot_25', fieldIndex: 24, x: 23, y: 25 },
  { id: 'plot_26', fieldIndex: 25, x: 24, y: 25 },
  { id: 'plot_27', fieldIndex: 26, x: 25, y: 25 },
  { id: 'plot_28', fieldIndex: 27, x: 26, y: 25 },
  { id: 'plot_29', fieldIndex: 28, x: 27, y: 25 },
  { id: 'plot_30', fieldIndex: 29, x: 28, y: 25 },

  { id: 'plot_31', fieldIndex: 30, x: 23, y: 26 },
  { id: 'plot_32', fieldIndex: 31, x: 24, y: 26 },
  { id: 'plot_33', fieldIndex: 32, x: 25, y: 26 },
  { id: 'plot_34', fieldIndex: 33, x: 26, y: 26 },
  { id: 'plot_35', fieldIndex: 34, x: 27, y: 26 },
  { id: 'plot_36', fieldIndex: 35, x: 28, y: 26 },

  { id: 'plot_37', fieldIndex: 36, x: 23, y: 27 },
  { id: 'plot_38', fieldIndex: 37, x: 24, y: 27 },
  { id: 'plot_39', fieldIndex: 38, x: 25, y: 27 },
  { id: 'plot_40', fieldIndex: 39, x: 26, y: 27 },
  { id: 'plot_41', fieldIndex: 40, x: 27, y: 27 },
  { id: 'plot_42', fieldIndex: 41, x: 28, y: 27 },

  { id: 'plot_43', fieldIndex: 42, x: 23, y: 28 },
  { id: 'plot_44', fieldIndex: 43, x: 24, y: 28 },
  { id: 'plot_45', fieldIndex: 44, x: 25, y: 28 },
  { id: 'plot_46', fieldIndex: 45, x: 26, y: 28 },
  { id: 'plot_47', fieldIndex: 46, x: 27, y: 28 },
  { id: 'plot_48', fieldIndex: 47, x: 28, y: 28 },

  // ── Zone C ──────────────────────────────────────────────────
  { id: 'plot_49', fieldIndex: 48, x: 31, y: 4 },
  { id: 'plot_50', fieldIndex: 49, x: 32, y: 4 },
  { id: 'plot_51', fieldIndex: 50, x: 33, y: 4 },
  { id: 'plot_52', fieldIndex: 51, x: 34, y: 4 },
  { id: 'plot_53', fieldIndex: 52, x: 35, y: 4 },
  { id: 'plot_54', fieldIndex: 53, x: 36, y: 4 },

  { id: 'plot_55', fieldIndex: 54, x: 31, y: 5 },
  { id: 'plot_56', fieldIndex: 55, x: 32, y: 5 },
  { id: 'plot_57', fieldIndex: 56, x: 33, y: 5 },
  { id: 'plot_58', fieldIndex: 57, x: 34, y: 5 },
  { id: 'plot_59', fieldIndex: 58, x: 35, y: 5 },
  { id: 'plot_60', fieldIndex: 59, x: 36, y: 5 },

  { id: 'plot_61', fieldIndex: 60, x: 31, y: 6 },
  { id: 'plot_62', fieldIndex: 61, x: 32, y: 6 },
  { id: 'plot_63', fieldIndex: 62, x: 33, y: 6 },
  { id: 'plot_64', fieldIndex: 63, x: 34, y: 6 },
  { id: 'plot_65', fieldIndex: 64, x: 35, y: 6 },
  { id: 'plot_66', fieldIndex: 65, x: 36, y: 6 },

  { id: 'plot_67', fieldIndex: 66, x: 31, y: 7 },
  { id: 'plot_68', fieldIndex: 67, x: 32, y: 7 },
  { id: 'plot_69', fieldIndex: 68, x: 33, y: 7 },
  { id: 'plot_70', fieldIndex: 69, x: 34, y: 7 },
  { id: 'plot_71', fieldIndex: 70, x: 35, y: 7 },
  { id: 'plot_72', fieldIndex: 71, x: 36, y: 7 },
]
