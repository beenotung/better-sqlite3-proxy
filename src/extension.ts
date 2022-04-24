export let unProxySymbol = Symbol('unProxy')

export function unProxy<T extends object>(row: T): T {
  if (unProxySymbol in row) {
    return (row as any)[unProxySymbol]
  }
  return row
}
