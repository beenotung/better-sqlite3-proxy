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

export function seedRow<T extends object, Filter extends Partial<T>>(
  table: T[],
  filter: Filter,
  extra?: Omit<T, keyof Filter>,
) {
  let row = find(table, filter)
  if (row) {
    if (extra) Object.assign(row, extra)
  } else {
    table.push({ ...filter, ...extra } as any as T)
  }
}
