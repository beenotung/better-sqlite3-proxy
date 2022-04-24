import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxyKeyValue } from '../src/key-value-proxy'
import { unProxy } from '../src/extension'
import { DBProxy } from './types'

context('proxyDB TestSuit', () => {
  let db: DBInstance
  db = newDB({
    path: join('data', 'key-value.sqlite3'),
    migrate: false,
  })
  let proxy = proxyKeyValue<DBProxy>(db)

  it('should reset table', () => {
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
  })
  it('should insert row by push', () => {
    proxy.user.push({ username: 'Alice' })
    expect(proxy.user.length).to.equals(1)
  })
  it('should select row by id', () => {
    expect(unProxy(proxy.user[1])).to.deep.equals({ username: 'Alice' })
  })
  it('should insert row by array index', () => {
    proxy.user[2] = { username: 'Bob' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ username: 'Bob' })
  })
  it('should update row', () => {
    proxy.user[2] = { username: 'Charlie' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ username: 'Charlie' })
  })
  it('should select column', () => {
    expect(proxy.user[2].username).to.equals('Charlie')
  })
  it('should select all rows', () => {
    expect(unProxy(proxy.user)).to.deep.equals([
      { username: 'Alice' },
      { username: 'Charlie' },
    ])
  })
  it('should delete row by id', () => {
    expect(proxy.user.length).to.equals(2)
    delete proxy.user[2]
    expect(proxy.user.length).to.equals(1)
  })
  it('should truncate table', () => {
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
})
