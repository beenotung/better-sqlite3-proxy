import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxyKeyValue } from '../src/key-value-proxy'
import {
  clearCache,
  count,
  del,
  filter,
  find,
  notNull,
  truncate,
  unProxy,
  update,
} from '../src/extension'
import { existsSync, unlinkSync } from 'fs'
import { fake } from 'sinon'

type DBProxy = {
  user: {
    id?: number
    username: string
    is_admin?: boolean
  }[]
  post: {
    id?: number
    user_id: number
    content: string
    created_at?: string
  }[]
  log: {
    id?: number
    remark?: string | null
  }[]
}

context('proxyKeyValue TestSuit', () => {
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
  it('should truncate table by length', () => {
    proxy.user[1] = { username: 'alice' }
    proxy.user[2] = { username: 'bob' }
    expect(proxy.user.length).not.to.equals(0)
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
  it('should truncate table with helper function', () => {
    proxy.user[1] = { username: 'alice' }
    proxy.user[2] = { username: 'bob' }
    expect(proxy.user.length).not.to.equals(0)
    truncate(proxy.user)
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
  it('should reuse id after truncate', () => {
    proxy.user[1] = { username: 'alice' }
    proxy.user[2] = { username: 'bob' }
    truncate(proxy.user)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
    expect(proxy.user.push({ username: 'alice' })).to.equals(1)
    expect(proxy.user.push({ username: 'bob' })).to.equals(2)
    expect(proxy.user[1].username).to.equals('alice')
    expect(proxy.user[2].username).to.equals('bob')
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
    proxy.post.length = 0
    proxy.post[1] = { id: 1, user_id: 1, content: 'Hello from Alice' }
    proxy.post[2] = { id: 2, user_id: 2, content: 'Hello from Bob' }
    proxy.post[3] = { id: 3, user_id: 1, content: 'Hi Bob' }
    let matches = filter(proxy.post, { user_id: 1 })
    expect(matches).to.deep.equals([
      { id: 1, user_id: 1, content: 'Hello from Alice' },
      { id: 3, user_id: 1, content: 'Hi Bob' },
    ])
  })
  it('should delete records by any columns', () => {
    proxy.log.length = 0
    expect(proxy.log.length).to.equals(0)
    proxy.log[1] = { remark: 'test 1' }
    proxy.log[2] = { remark: 'test 2' }
    expect(proxy.log.length).to.equals(2)

    del(proxy.log, { remark: 'test 1' })
    expect(proxy.log.length).to.equals(1)

    del(proxy.log, { remark: 'test 1' })
    expect(proxy.log.length).to.equals(1)

    del(proxy.log, { remark: 'test 2' })
    expect(proxy.log.length).to.equals(0)
  })
  it('should return number of deleted rows', () => {
    let remark = 'to-be-deleted'
    proxy.log.push({ remark })
    proxy.log.push({ remark })
    proxy.log.push({ remark })
    expect(del(proxy.log, { remark })).to.equals(3)
    expect(del(proxy.log, { remark })).to.equals(0)
  })
  it('should count records by any columns', () => {
    expect(count(proxy.post, { user_id: 1 })).to.equals(2)
    expect(count(proxy.post, { user_id: 101 })).to.equals(0)
  })
  context('null condition', () => {
    beforeEach(() => {
      proxy.log.length = 0
      proxy.log[1] = { id: 1, remark: 'mock-value-1' }
      proxy.log[2] = { id: 2, remark: null }
      proxy.log[3] = { id: 3, remark: 'mock-value-3' }
      proxy.log[4] = { id: 4, remark: null }
      proxy.log[5] = { id: 5, remark: 'mock-value-5' }
      expect(proxy.log).to.have.lengthOf(5)
    })
    context('where is null', () => {
      it('should find columns', () => {
        expect(find(proxy.log, { id: 1, remark: null })).undefined
        expect(find(proxy.log, { id: 2, remark: null })).not.undefined
      })
      it('should filter columns', () => {
        let matches = filter(proxy.log, { remark: null })
        expect(matches).to.have.lengthOf(2)
        expect(matches[0].id).to.equals(2)
        expect(matches[1].id).to.equals(4)
      })
      it('should count columns', () => {
        expect(count(proxy.log, { remark: null })).to.equals(2)
      })
      it('should update columns', () => {
        let changes = update(proxy.log, { remark: null }, { remark: 'v2' })
        expect(changes).to.equals(2)
        expect(proxy.log[1].remark).to.equals('mock-value-1')
        expect(proxy.log[2].remark).to.equals('v2')
        expect(proxy.log[3].remark).to.equals('mock-value-3')
        expect(proxy.log[4].remark).to.equals('v2')
        expect(proxy.log[5].remark).to.equals('mock-value-5')
      })
      it('should delete rows', () => {
        let changes = del(proxy.log, { remark: null })
        expect(changes).to.equals(2)
        expect(proxy.log.length).to.equals(3)
        expect(proxy.log[1].remark).to.equals('mock-value-1')
        expect(proxy.log[2]).to.be.undefined
        expect(proxy.log[3].remark).to.equals('mock-value-3')
        expect(proxy.log[4]).to.be.undefined
        expect(proxy.log[5].remark).to.equals('mock-value-5')
      })
    })
    context('where is not null', () => {
      it('should find columns', () => {
        expect(find(proxy.log, { id: 1, remark: notNull })).not.undefined
        expect(find(proxy.log, { id: 2, remark: notNull })).undefined
      })
      it('should filter columns', () => {
        let matches = filter(proxy.log, { remark: notNull })
        expect(matches).to.have.lengthOf(3)
        expect(matches[0].id).to.equals(1)
        expect(matches[1].id).to.equals(3)
        expect(matches[2].id).to.equals(5)
      })
      it('should count columns', () => {
        expect(count(proxy.log, { remark: notNull })).to.equals(3)
      })
      it('should update columns', () => {
        let changes = update(proxy.log, { remark: notNull }, { remark: 'v2' })
        expect(changes).to.equals(3)
        expect(proxy.log[1].remark).to.equals('v2')
        expect(proxy.log[2].remark).to.be.null
        expect(proxy.log[3].remark).to.equals('v2')
        expect(proxy.log[4].remark).to.be.null
        expect(proxy.log[5].remark).to.equals('v2')
      })
      it('should delete rows', () => {
        let changes = del(proxy.log, { remark: notNull })
        expect(changes).to.equals(3)
        expect(proxy.log.length).to.equals(2)
        expect(proxy.log[1]).to.be.undefined
        expect(proxy.log[2].remark).to.be.null
        expect(proxy.log[3]).to.be.undefined
        expect(proxy.log[4].remark).to.be.null
        expect(proxy.log[5]).to.be.undefined
      })
    })
  })
  context('proxy array methods', () => {
    context('proxy.table.push()', () => {
      before(() => {
        proxy.log.length = 0
      })
      it('should returns id of last insert row', () => {
        expect(proxy.log.push({ remark: '' })).to.equals(1)
      })
      it('should reuse id of last row', () => {
        expect(proxy.log.push({ remark: '' })).to.equals(2)
        delete proxy.log[2]
        expect(proxy.log.push({ remark: '' })).to.equals(2)
      })
      it('should not reuse id of non-last row', () => {
        expect(proxy.log.push({ remark: '' })).to.equals(3)
        delete proxy.log[2]
        expect(proxy.log.push({ remark: '' })).to.equals(4)
      })
    })
    context('access each populated row', () => {
      beforeEach(() => {
        proxy.log.length = 0
        proxy.log[1] = { id: 1, remark: 'first' }
        proxy.log[3] = { id: 3, remark: 'third' }
        proxy.log[10] = { id: 10, remark: 'ten' }
      })
      it('should access via .forEach() method', () => {
        let forEach = fake()
        proxy.log.forEach(forEach)
        expect(forEach.callCount).to.equals(3)
        expect(forEach.args).to.deep.equals([
          [{ id: 1, remark: 'first' }, 1, proxy.log],
          [{ id: 3, remark: 'third' }, 3, proxy.log],
          [{ id: 10, remark: 'ten' }, 10, proxy.log],
        ])
      })
      it('should access via .map() method', () => {
        let result = proxy.log.map(row => row.remark)
        expect(result).to.deep.equals(['first', 'third', 'ten'])
      })
      it('should access via .filter() method', () => {
        let result = proxy.log.filter(row => row.remark?.startsWith('t'))
        expect(result).to.have.lengthOf(2)

        expect(result[0].id).to.equals(3)
        expect(result[0].remark).to.equals('third')

        expect(result[1].id).to.equals(10)
        expect(result[1].remark).to.equals('ten')
      })
      it('should access via .slice() method', () => {
        let result = proxy.log.slice()
        expect(result).to.have.lengthOf(3)

        expect(result[0].id).to.equals(1)
        expect(result[0].remark).to.equals('first')

        expect(result[1].id).to.equals(3)
        expect(result[1].remark).to.equals('third')

        expect(result[2].id).to.equals(10)
        expect(result[2].remark).to.equals('ten')
      })
      it('should access via .slice(start) method', () => {
        let result = proxy.log.slice(3)
        expect(result).to.have.lengthOf(2)

        expect(result[0].id).to.equals(3)
        expect(result[0].remark).to.equals('third')

        expect(result[1].id).to.equals(10)
        expect(result[1].remark).to.equals('ten')
      })
      it('should access via .slice(start,end) method', () => {
        let result = proxy.log.slice(3, 10)
        expect(result).to.have.lengthOf(1)

        expect(result[0].id).to.equals(3)
        expect(result[0].remark).to.equals('third')
      })
      it('should access via for-loop', () => {
        let each = fake()
        for (let row of proxy.log) {
          expect(typeof row).to.equals('object')
          expect(typeof row.id).to.equals('number')
          expect(typeof row.remark).to.equals('string')
          each({
            id: row.id,
            remark: row.remark,
          })
        }
        expect(each.callCount).to.equals(3)
        expect(each.args).to.deep.equals([
          [{ id: 1, remark: 'first' }],
          [{ id: 3, remark: 'third' }],
          [{ id: 10, remark: 'ten' }],
        ])
      })
    })
  })
  it('should update multiple columns in batch', () => {
    proxy.user[1] = { username: 'admin', is_admin: true }
    let user = proxy.user[1]
    expect(user.username).to.equals('admin')
    expect(user.is_admin).to.be.equals(true)

    update(proxy.user, 1, { username: 'alice', is_admin: false })
    user = proxy.user[1]
    expect(user.username).to.equals('alice')
    expect(user.is_admin).to.be.equals(false)
  })
  it('should return number of updated rows', () => {
    expect(update(proxy.user, 1, { is_admin: false })).to.equals(1)
    expect(update(proxy.user, 101, { is_admin: false })).to.equals(0)
  })
})

context('key-value proxy memory test', () => {
  let db = newDB({
    memory: true,
    migrate: false,
  })
  let proxy = proxyKeyValue<{ log: DBProxy['log'] }>(db)
  it('should clearCache without runtime error', () => {
    let n = 10
    for (let i = 1; i < n; i++) {
      proxy.log[i] = { remark: 'remark ' + i }
      proxy.log[i]
    }
    clearCache(proxy)
  })
  it('should not delete data from db after clearCache', () => {
    delete proxy.log[1]
    expect(proxy.log[1]).undefined

    proxy.log[1] = { remark: 'remark 1' }
    expect(proxy.log[1].remark).to.equal('remark 1')

    clearCache(proxy)
    expect(proxy.log[1].remark).to.equal('remark 1')
  })
})
