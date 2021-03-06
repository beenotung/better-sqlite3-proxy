import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxySchema } from '../src/schema-proxy'
import { filter, find, unProxy } from '../src/extension'
import { existsSync, unlinkSync } from 'fs'

export type DBProxy = {
  user: User[]
  post: Post[]
  log: Log[]
  order: Order[]
}
export type User = {
  id?: number
  username: string
}
export type Post = {
  id?: number
  user_id: number
  content: string
  created_at?: string
  author?: User
}
export type Log = {
  id?: number
}
export type Order = {
  id?: number
  user_id: number
  user?: User
}

context('proxyDB TestSuit', () => {
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
);
-- Down
drop table post;
`,
          /* sql */ `
-- Up
create table if not exists log (
  id integer primary key
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
    expect(unProxy(proxy.user[1])).to.deep.equals({ id: 1, username: 'Alice' })
  })
  it('should insert row by array index', () => {
    proxy.user[2] = { username: 'Bob' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ id: 2, username: 'Bob' })
  })
  it('should update a specific column', () => {
    proxy.user[2].username = 'Charlie'
    expect(unProxy(proxy.user[2])).to.deep.equals({
      id: 2,
      username: 'Charlie',
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
      { id: 1, username: 'Alice' },
      { id: 2, username: 'Charlie' },
    ])
  })
  it('should delete row by id', () => {
    expect(proxy.user.length).to.equals(2)
    delete proxy.user[2]
    expect(proxy.user.length).to.equals(1)
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
    expect(unProxy(find(proxy.user, { username: 'Alice' }))).to.deep.equals({
      id: 1,
      username: 'Alice',
    })
    expect(unProxy(find(proxy.user, { username: 'Bob' }))).to.deep.equals({
      id: 2,
      username: 'Bob',
    })
  })
  it('should find record by multiple columns', () => {
    proxy.post.length = 0
    proxy.post[1] = { user_id: 1, content: 'Hello from Alice' }
    proxy.post[2] = { user_id: 2, content: 'Hello from Bob' }
    proxy.post[3] = { user_id: 1, content: 'Hi Bob' }
    let match = find(proxy.post, { user_id: 1, content: 'Hi Bob' })
    expect(match).not.to.be.undefined
    expect(match.id).to.equals(3)
  })
  it('should filter records by any columns', () => {
    let matches = filter(proxy.post, { user_id: 1 })
    expect(matches).to.have.lengthOf(2)
    expect(matches[0].id).to.equals(1)
    expect(matches[1].id).to.equals(3)
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
  it('should resolve reference row from foreign key', () => {
    expect(proxy.post[3].user_id).to.equals(1)
    expect(proxy.user[1].username).to.equals('Alice')
    let author = proxy.post[3].author
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
})
