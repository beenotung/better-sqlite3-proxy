import DB from 'better-sqlite3-helper'
import { DBInstance, newDB } from 'better-sqlite3-schema'
import { join } from 'path'
import { proxyDB } from '../src/db-proxy'
import { DBProxy, e2eTest } from './e2e'

context('proxyDB TestSuit', () => {
  let db: DBInstance
  db = newDB({
    path: join('data', 'sqlite3.db'),
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
  let proxy = proxyDB<DBProxy>(db, {
    user: ['id', 'username'],
    post: ['id', 'user_id', 'content', 'created_at'],
  })
  e2eTest(proxy)
})
