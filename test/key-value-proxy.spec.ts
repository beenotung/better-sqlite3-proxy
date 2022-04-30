import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxyKeyValue } from '../src/key-value-proxy'
import { filter, find, unProxy } from '../src/extension'
import { existsSync, unlinkSync } from 'fs'

type DBProxy = {
  user: {
    id?: number
    username: string
  }[]
  post: {
    id?: number
    user_id: number
    content: string
    created_at?: string
  }[]
  log: {
    id?: number
  }[]
}

context('proxyDB TestSuit', () => {
  let db: DBInstance
  let proxy: DBProxy

  before(() => {
    let dbFile = join('data', 'key-value.sqlite3')
    if (existsSync(dbFile)) {
      unlinkSync(dbFile)
    }
    db = newDB({
      path: dbFile,
      migrate: false,
    })

    proxy = proxyKeyValue<DBProxy>(db)
  })

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
  it('should update a specific column', () => {
    proxy.user[2] = { username: 'Charlie' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ username: 'Charlie' })
  })
  it('should update multiple columns', () => {
    proxy.post[1] = { user_id: 2, content: 'B' }
    proxy.post[1] = { user_id: 1, content: 'A' }
    expect(proxy.post[1].user_id).to.equals(1)
    expect(proxy.post[1].content).to.equals('A')
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
  it('should find record by non-id column', () => {
    proxy.user[1] = { id: 1, username: 'Alice' }
    proxy.user[2] = { id: 2, username: 'Bob' }
    expect(find(proxy.user, { username: 'Alice' })).to.deep.equals({
      id: 1,
      username: 'Alice',
    })
    expect(find(proxy.user, { username: 'Bob' })).to.deep.equals({
      id: 2,
      username: 'Bob',
    })
  })
  it('should find record by multiple columns', () => {
    proxy.post.length = 0
    proxy.post[1] = { id: 1, user_id: 1, content: 'Hello from Alice' }
    proxy.post[2] = { id: 2, user_id: 2, content: 'Hello from Bob' }
    proxy.post[3] = { id: 3, user_id: 1, content: 'Hi Bob' }
    let match = find(proxy.post, { user_id: 1, content: 'Hi Bob' })
    expect(match).to.deep.equals({ id: 3, user_id: 1, content: 'Hi Bob' })
  })
  it('should filter records by any columns', () => {
    let matches = filter(proxy.post, { user_id: 1 })
    expect(matches).to.deep.equals([
      { id: 1, user_id: 1, content: 'Hello from Alice' },
      { id: 3, user_id: 1, content: 'Hi Bob' },
    ])
  })
  context('proxy.table.push()', () => {
    before(() => {
      proxy.log.length = 0
    })
    it('should returns id of last insert row', () => {
      expect(proxy.log.push({})).to.equals(1)
    })
    it('should reuse id of last row', () => {
      expect(proxy.log.push({})).to.equals(2)
      delete proxy.log[2]
      expect(proxy.log.push({})).to.equals(2)
    })
    it('should not reuse id of non-last row', () => {
      expect(proxy.log.push({})).to.equals(3)
      delete proxy.log[2]
      expect(proxy.log.push({})).to.equals(4)
    })
  })
})
