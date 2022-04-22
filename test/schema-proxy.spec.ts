import { DBInstance, newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { join } from 'path'
import { proxySchema } from '../src/schema-proxy'
import { unProxy } from '../src/un-proxy'
import { DBProxy } from './types'

context('proxyDB TestSuit', () => {
  let db: DBInstance
  db = newDB({
    path: join('data', 'schema.sqlite3'),
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
      ],
    },
  })
  let proxy = proxySchema<DBProxy>(db, {
    user: ['id', 'username'],
    post: ['id', 'user_id', 'content', 'created_at'],
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
    expect(unProxy(proxy.user[1])).to.deep.equals({ id: 1, username: 'Alice' })
  })
  it('should insert row by array index', () => {
    proxy.user[2] = { username: 'Bob' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ id: 2, username: 'Bob' })
  })
  it('should update row', () => {
    proxy.user[2].username = 'Charlie'
    expect(unProxy(proxy.user[2])).to.deep.equals({
      id: 2,
      username: 'Charlie',
    })
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
  it('should truncate table', () => {
    expect(proxy.user.length).not.equals(0)
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
})
