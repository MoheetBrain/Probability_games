import { BOARD_SIZE } from './constants'
import type { Position } from './types'

/**
 * The central column and four 3×3 corner blocks form five deliberately
 * visible territories. The seven cells on row four act as a clean seam.
 * This function is the single source of truth for every board cell.
 */
export function sectorForCell(row: number, col: number): number {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) throw new Error('Cell is outside the board')
  if (row === 3) return [0, 3, 2, 2, 2, 4, 1][col]
  if (row <= 2) return col <= 2 ? 0 : col === 3 ? 2 : 1
  return col <= 2 ? 3 : col === 3 ? 2 : 4
}

export function sectorCells(sector: number): Position[] {
  const cells: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) if (sectorForCell(row, col) === sector) cells.push({ row, col })
  return cells
}

export const SECTOR_CELLS: Position[][] = Array.from({ length: 5 }, (_, sector) => sectorCells(sector))

export function neighbouringSector(row: number, col: number, deltaRow: number, deltaCol: number): number | undefined {
  const nextRow = row + deltaRow
  const nextCol = col + deltaCol
  return nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE ? undefined : sectorForCell(nextRow, nextCol)
}
