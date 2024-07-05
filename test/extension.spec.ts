import { expect } from 'chai'
import {
  countSymbol,
  delSymbol,
  filterSymbol,
  findSymbol,
  notNull,
  unProxySymbol,
  updateSymbol,
  clearCacheSymbol,
} from '../src/extension'
import * as lib from '../src/extension'

describe('avoid using unique symbols to tolerant different instance of package', () => {
  let allNames = new Set(
    Object.entries(lib)
      .filter(([key, value]) => typeof value === 'symbol')
      .map(([key]) => key),
  )
  let testedNames = new Set()
  function test(symbol: symbol) {
    let name = Symbol.keyFor(symbol)!
    it(name, () => {
      expect(symbol).to.equal(Symbol.for(name))
      let exportName = name == 'not null' ? 'notNull' : name + 'Symbol'
      testedNames.add(exportName)
    })
  }
  test(unProxySymbol)
  test(findSymbol)
  test(filterSymbol)
  test(delSymbol)
  test(countSymbol)
  test(updateSymbol)
  test(notNull as any)
  test(clearCacheSymbol)
  it('should have tested all symbols', () => {
    expect(Array.from(allNames)).to.deep.equals(Array.from(testedNames))
  })
})
