export let unProxySymbol = Symbol('unProxy')

export function unProxy<T extends object>(row: T): T {
  if (unProxySymbol in row) {
    return (row as any)[unProxySymbol]
  }
  return row
}

export let findSymbol = Symbol('find')

export function find<T extends object>(
  table: T[],
  filter: Partial<T>,
): T | undefined {
  if (findSymbol in table) {
    return (table as any)[findSymbol](filter)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let filterSymbol = Symbol('filter')

export function filter<T extends object>(table: T[], filter: Partial<T>): T[] {
  if (filterSymbol in table) {
    return (table as any)[filterSymbol](filter)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let updateSymbol = Symbol('update')

export function update<T extends object>(
  table: T[],
  id: number,
  partial: Partial<T>,
) {
  if (updateSymbol in table) {
    return (table as any)[updateSymbol](id, partial)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}
