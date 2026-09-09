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
  { id: 'plot_01', fieldIndex: 0,  x: 8,  y: 18 },
  { id: 'plot_02', fieldIndex: 1,  x: 9,  y: 18 },
  { id: 'plot_03', fieldIndex: 2,  x: 10, y: 18 },
  { id: 'plot_04', fieldIndex: 3,  x: 11, y: 18 },

  { id: 'plot_05', fieldIndex: 4,  x: 8,  y: 19 },
  { id: 'plot_06', fieldIndex: 5,  x: 9,  y: 19 },
  { id: 'plot_07', fieldIndex: 6,  x: 10, y: 19 },
  { id: 'plot_08', fieldIndex: 7,  x: 11, y: 19 },

  { id: 'plot_09', fieldIndex: 8,  x: 8,  y: 20 },
  { id: 'plot_10', fieldIndex: 9,  x: 9,  y: 20 },
  { id: 'plot_11', fieldIndex: 10, x: 10, y: 20 },
  { id: 'plot_12', fieldIndex: 11, x: 11, y: 20 },

  { id: 'plot_13', fieldIndex: 12, x: 8,  y: 21 },
  { id: 'plot_14', fieldIndex: 13, x: 9,  y: 21 },
  { id: 'plot_15', fieldIndex: 14, x: 10, y: 21 },
  { id: 'plot_16', fieldIndex: 15, x: 11, y: 21 },
]

