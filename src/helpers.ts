import { find, update } from './extension'

export type Table<T extends object> = Array<{ id: number } & T>

export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0]
}

export function fromSqliteTimestamp(timestamp: string | Date): Date {
  return typeof timestamp === 'string'
    ? new Date(timestamp.replace(' ', 'T') + '.000Z')
    : timestamp
}

export function getTimes<
  T extends {
    id?: number | null
    created_at?: string | null
    updated_at?: string | null
  },
  Field extends keyof T = 'created_at' | 'updated_at',
>(
  row: T,
  fields: Field[] = ['created_at', 'updated_at'] as Field[],
): Record<Field, Date | null> {
  let times = {} as Record<Field, Date | null>
  for (let field of fields) {
    let time = (row as any)[field]
    times[field] = time ? fromSqliteTimestamp(time) : null
  }
  return times
}

export function seedRow<
  T extends { id?: number | null },
  Filter extends Partial<T>,
>(table: T[], filter: Filter, extra?: Omit<T, keyof Filter>): number {
  let row = find(table, filter)
  if (row) {
    if (extra) update(table, filter, extra as Partial<T>)
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
