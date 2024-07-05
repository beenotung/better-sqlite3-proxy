import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxySchema } from '../src/schema-proxy'
import {
  clearCache,
  count,
  del,
  filter,
  find,
  notNull,
  unProxy,
  update,
} from '../src/extension'
import { existsSync, unlinkSync } from 'fs'
import { fake } from 'sinon'
import { getTimes } from '../src/helpers'

export type DBProxy = {
  user: User[]
  post: Post[]
  log: Log[]
  order: Order[]
}
export type User = {
  id?: number
  username: string
  is_admin?: boolean | null
}
export type Post = {
  id?: number
  user_id: number
  content: string
  created_at?: string
  updated_at?: string
  author?: User
  delete_time?: string | Date | null
}
export type Log = {
  id?: number
  remark: string | null
}
export type Order = {
  id?: number
  user_id: number
  user?: User
}

context('proxySchema TestSuit', () => {
  let db: DBInstance
  let proxy: DBProxy

  before(() => {
    let dbFile = join('data', 'schema.sqlite3')
    if (existsSync(dbFile)) {
      unlinkSync(dbFile)
    }
    db = newDB({
      path: dbFile,
      migrate: {
        migrations: [
          /* sql */ `
-- Up
create table if not exists user (
  id integer primary key
, username text not null unique
, is_admin boolean
);
-- Down
drop table user;
`,
          /* sql */ `
-- Up
create table if not exists post (
  id integer primary key
, user_id integer not null references user (id)
, content text not null
, created_at timestamp not null default current_timestamp
, updated_at timestamp
, delete_time timestamp
);
-- Down
drop table post;
`,
          /* sql */ `
-- Up
create table if not exists log (
  id integer primary key
, remark text
);
-- Down
drop table post;
`,
          /* sql */ `
-- Up
create table if not exists "order" (
  id integer primary key
, user_id integer not null references user (id)
);
-- Down
drop table "order";
`,
        ],
      },
    })
    proxy = proxySchema<DBProxy>(db, {
      user: [],
      post: [['author', { field: 'user_id', table: 'user' }]],
      log: [],
      order: [['user', { field: 'user_id', table: 'user' }]],
    })
  })

  it('should reset table', () => {
    proxy.post.length = 0
    proxy.user.length = 0
    expect(proxy.post.length).to.equals(0)
    expect(proxy.user.length).to.equals(0)
  })
  it('should insert row by push', () => {
    proxy.user.push({ username: 'Alice' })
    expect(proxy.user.length).to.equals(1)
  })
  it('should select row by id', () => {
    expect(unProxy(proxy.user[1])).to.deep.equals({
      id: 1,
      username: 'Alice',
      is_admin: null,
    })
  })
  it('should insert row by array index', () => {
    proxy.user[2] = { username: 'Bob' }
    expect(unProxy(proxy.user[2])).to.deep.equals({
      id: 2,
      username: 'Bob',
      is_admin: null,
    })
  })
  it('should update a specific column', () => {
    proxy.user[2].username = 'Charlie'
    expect(unProxy(proxy.user[2])).to.deep.equals({
      id: 2,
      username: 'Charlie',
      is_admin: null,
    })
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
      { id: 1, username: 'Alice', is_admin: null },
      { id: 2, username: 'Charlie', is_admin: null },
    ])
  })
  it('should delete row by id', () => {
    expect(proxy.user.length).to.equals(2)
    delete proxy.user[2]
    expect(proxy.user.length).to.equals(1)
  })
  it('should auto convert boolean values into 1/0', () => {
    function test(options: { input: boolean | null; output: 1 | 0 | null }) {
      let id = proxy.user.push({
        username: 'admin?' + options.input,
        is_admin: options.input,
      })
      expect(proxy.user[id].is_admin).to.equals(options.output)
      expect(find(proxy.user, { id, is_admin: options.input })?.id).to.equals(
        id,
      )
      expect(
        filter(proxy.user, { id, is_admin: options.input }),
      ).to.have.lengthOf(1)
    }

    test({ input: null, output: null })
    test({ input: true, output: 1 })
    test({ input: false, output: 0 })
  })
  it('should truncate table', () => {
    expect(proxy.user.length).not.equals(0)
    proxy.post.length = 0
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
  it('should find record by non-id column', () => {
    proxy.user[1] = { id: 1, username: 'Alice' }
    proxy.user[2] = { id: 2, username: 'Bob' }
    expect(unProxy(find(proxy.user, { username: 'Alice' })!)).to.deep.equals({
      id: 1,
      username: 'Alice',
      is_admin: null,
    })
    expect(unProxy(find(proxy.user, { username: 'Bob' })!)).to.deep.equals({
      id: 2,
      username: 'Bob',
      is_admin: null,
    })
  })
  it('should find record by multiple columns', () => {
    proxy.post.length = 0
    proxy.post[1] = { user_id: 1, content: 'Hello from Alice' }
    proxy.post[2] = { user_id: 2, content: 'Hello from Bob' }
    proxy.post[3] = { user_id: 1, content: 'Hi Bob' }
    let match = find(proxy.post, { user_id: 1, content: 'Hi Bob' })!
    expect(match).not.to.be.undefined
    expect(match.id).to.equals(3)
  })
  it('should filter records by any columns', () => {
    let matches = filter(proxy.post, { user_id: 1 })
    expect(matches).to.have.lengthOf(2)
    expect(matches[0].id).to.equals(1)
    expect(matches[1].id).to.equals(3)
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
    before(() => {
      proxy.log.length = 0
      proxy.log[1] = { remark: 'mock-value-1' }
      proxy.log[2] = { remark: null }
      proxy.log[3] = { remark: 'mock-value-3' }
      proxy.log[4] = { remark: null }
      proxy.log[5] = { remark: 'mock-value-5' }
      expect(proxy.log).to.have.lengthOf(5)
    })
    context('where is null', () => {
      it('should find columns', () => {
        expect(find(proxy.log, { id: 1, remark: null })).undefined
        expect(find(proxy.log, { id: 2, remark: null })).not.undefined
      })
      it('should filter columns', () => {
        expect(filter(proxy.log, { remark: null })).to.have.lengthOf(2)
      })
      it('should count columns', () => {
        expect(count(proxy.log, { remark: null })).to.equals(2)
      })
    })
    context('where is not null', () => {
      it('should find columns', () => {
        expect(find(proxy.log, { id: 1, remark: notNull })).not.undefined
        expect(find(proxy.log, { id: 2, remark: notNull })).undefined
      })
      it('should filter columns', () => {
        expect(filter(proxy.log, { remark: notNull })).to.have.lengthOf(3)
      })
      it('should count columns', () => {
        expect(count(proxy.log, { remark: notNull })).to.equals(3)
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
        proxy.log[1] = { remark: 'first' }
        proxy.log[3] = { remark: 'third' }
        proxy.log[10] = { remark: 'ten' }
      })
      it('should access via .forEach() method', () => {
        let forEach = fake()
        proxy.log.forEach(forEach)
        expect(forEach.callCount).to.equals(3)
        // TODO test the value
        expect(forEach.args).to.deep.equals([
          [{}, 1, proxy.log],
          [{}, 3, proxy.log],
          [{}, 10, proxy.log],
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
  it('should resolve reference row from foreign key', () => {
    expect(proxy.post[3].user_id).to.equals(1)
    expect(proxy.user[1].username).to.equals('Alice')
    let author = proxy.post[3].author!
    expect(author).not.to.be.undefined
    expect(author.username).to.equals('Alice')
  })
  it('should update foreign key when assign specific reference row', () => {
    expect(proxy.post[3].user_id).to.equals(1)
    proxy.post[3].author = proxy.user[2]
    expect(proxy.post[3].user_id).to.equals(2)
  })
  it('should update foreign key when updating multiple fields including reference row', () => {
    proxy.post[3].content = 'old'
    proxy.post[3].user_id = 1
    expect(proxy.post[3].content).to.equals('old')
    expect(proxy.post[3].user_id).to.equals(1)
    proxy.post[3] = {
      author: proxy.user[2],
      content: 'new',
    } as Partial<Post> as Post
    expect(proxy.post[3].content).to.equals('new')
    expect(proxy.post[3].user_id).to.equals(2)
  })
  it('should save foreign key when inserting row including reference row', () => {
    let id = proxy.post.push({
      author: proxy.user[2],
      content: 'with author',
    } as Partial<Post> as Post)
    expect(proxy.post[id].content).to.equals('with author')
    expect(proxy.post[id].user_id).to.equals(2)
  })
  context('convert Date instance to GMT timestamp', () => {
    let date = new Date('2022-09-25T09:25:12+08:00')
    let timestamp = '2022-09-25 01:25:12'
    let user_id = 1
    let content = 'mock-content'
    let post_id: number
    before(() => {
      proxy.user[1] = { username: 'alice' }
    })
    it('should convert when insert', () => {
      post_id = proxy.post.push({ user_id, content, delete_time: date })
      expect(proxy.post[post_id].delete_time).to.equals(timestamp)
    })
    it('should convert when update', () => {
      proxy.post[post_id].delete_time = null
      expect(proxy.post[post_id].delete_time).to.be.null
      proxy.post[post_id].delete_time = date
      expect(proxy.post[post_id].delete_time).to.equals(timestamp)
    })
    it('should convert when find', () => {
      let match = find(proxy.post, { id: post_id, delete_time: date })!
      expect(match).not.undefined
      expect(match.id).to.equals(post_id)
    })
    it('should convert when filter', () => {
      let matches = filter(proxy.post, { id: post_id, delete_time: date })
      expect(matches).to.have.lengthOf(1)
      expect(matches[0].id).to.equals(post_id)
    })
  })
  it('should update multiple columns in batch', () => {
    proxy.user[1] = { username: 'admin', is_admin: true }
    let user = proxy.user[1]
    expect(user.username).to.equals('admin')
    expect(user.is_admin).to.be.equals(1)

    update(proxy.user, 1, { username: 'alice', is_admin: false })
    expect(user.username).to.equals('alice')
    expect(user.is_admin).to.be.equals(0)
  })
  it('should return number of updated rows', () => {
    expect(update(proxy.user, 1, { is_admin: false })).to.equals(1)
    expect(update(proxy.user, 101, { is_admin: false })).to.equals(0)
  })
  context('getTimes()', () => {
    before(() => {
      proxy.user[1] = { username: 'alice' }
      proxy.post[1] = { user_id: 1, content: 'sample post' }
      proxy.post[2] = { user_id: 1, content: 'updated post', updated_at: 't1' }
      proxy.post[3] = {
        user_id: 1,
        content: 'deleted post',
        updated_at: 't2',
        delete_time: 't3',
      }
    })
    it('should get created_at and updated_at by default', () => {
      let row = proxy.post[3]
      let times = getTimes(row)
      expect(Object.keys(times)).deep.equals(['created_at', 'updated_at'])
      expect(times.created_at).not.null
      expect(times.updated_at).not.null
    })
    it('should only get specified field', () => {
      let row = proxy.post[3]
      let times = getTimes(row, ['delete_time'])
      expect(Object.keys(times)).deep.equals(['delete_time'])
      expect(times.delete_time).not.null
    })
  })
})

context('schema proxy memory test', () => {
  let db = newDB({
    memory: true,
    migrate: {
      migrations: [
        /* sql */ `
-- Up
create table log (
  id integer primary key
, remark text
);
-- Down
drop table log;
      `,
      ],
    },
  })
  let proxy = proxySchema<{ log: Log[] }>(db, { log: [] })
  it('should not run out of memory due to too much row proxy cache', () => {
    let n = 1_000_000
    for (let i = 1; i < n; i++) {
      proxy.log[i] = { remark: 'remark ' + i }
      proxy.log[i]
      if (i % 100_000 == 0) {
        clearCache(proxy)
        let rss = process.memoryUsage().rss
        let averageSize = rss / i
        if (averageSize < 360) {
          return
        }
      }
    }
    let rss = process.memoryUsage().rss
    let averageSize = rss / n
    throw new Error(
      `memory not freed? n=${n.toLocaleString()}, rss=${rss.toLocaleString()}, averageSize=${averageSize}`,
    )
  }).timeout(20 * 1000)
  it('should not delete data from db after clearCache', () => {
    delete proxy.log[1]
    expect(proxy.log[1]).undefined

    proxy.log[1] = { remark: 'remark 1' }
    expect(proxy.log[1].remark).to.equal('remark 1')

    clearCache(proxy)
    expect(proxy.log[1].remark).to.equal('remark 1')
  })
})
