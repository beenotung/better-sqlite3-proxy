export type Table<T extends object> = Array<{ id: number } & T>

export function toSqliteTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0]
}

export function fromSqliteTimestamp(timestamp: string | Date): Date {
  return typeof timestamp === 'string'
    ? new Date(timestamp.replace(' ', 'T') + '.000Z')
    : timestamp
}
