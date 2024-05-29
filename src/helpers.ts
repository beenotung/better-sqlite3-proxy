import { find } from './extension'

export type Table<T extends object> = Array<{ id: number } & T>

export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0]
}

export function fromSqliteTimestamp(timestamp: string | Date): Date {
  return typeof timestamp === 'string'
    ? new Date(timestamp.replace(' ', 'T') + '.000Z')
    : timestamp
}

export function seedRow<
  T extends { id?: number | null },
  Filter extends Partial<T>,
>(table: T[], filter: Filter, extra?: Omit<T, keyof Filter>): number {
  let row = find(table, filter)
  if (row) {
    if (extra) Object.assign(row, extra)
    return row.id!
  } else {
    return table.push({ ...filter, ...extra } as any as T)
  }
}

export function upsert<Table extends { id?: number | null }>(
  table: Table[],
  key: keyof Table,
  data: Table,
): number {
  let filter = { [key]: data[key] } as Partial<Table>
  let row = find(table, filter)
  if (row) return row.id!
  return table.push(data)
}

export function getId<
  Table extends { id?: number | null },
  Key extends keyof Table,
>(table: Table[], key: Key, value: null | undefined): null
export function getId<
  Table extends { id?: number | null },
  Key extends keyof Table,
>(table: Table[], key: Key, value: Table[Key]): number
export function getId<
  Table extends { id?: number | null },
  Key extends keyof Table,
>(
  table: Table[],
  key: Key,
  value: Table[Key] | null | undefined,
): number | null {
  if (value == null || value == undefined) return null
  let filter = { [key]: value } as any
  return upsert(table, key, filter)
}
