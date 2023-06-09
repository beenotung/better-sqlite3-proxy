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

export let delSymbol = Symbol('del')

export function del<T extends object>(table: T[], partial: Partial<T>) {
  if (delSymbol in table) {
    return (table as any)[delSymbol](partial)
  }
  throw new Error(
    'expect table proxy, but got: ' + Object.prototype.toString.call(table),
  )
}

export let countSymbol = Symbol('count')

export function count<T extends object>(table: T[], partial: Partial<T>) {
  if (countSymbol in table) {
    return (table as any)[countSymbol](partial)
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

export let notNull = Symbol('not null') as any as null
