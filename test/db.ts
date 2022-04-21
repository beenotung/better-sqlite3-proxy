import DB from 'better-sqlite3-helper'
import { join } from 'path'
import { proxyDB } from '../src/proxy'

export let db = DB({
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

let proxy = proxyDB<{
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
}>(db)

proxy.user[1] = { id: 1, username: 'Alice' }
console.log('user[1]:', proxy.user[1].username)

proxy.user[1] = { username: 'alice' }
if (proxy.user.length < 2) {
  proxy.user[2] = { username: 'bob' }
}
proxy.post[1] = {
  content: 'hello world',
  user_id: 1,
}
// proxy.users[0] = { username: 'zero' }

console.log({
  user_1: proxy.user[1],
  user_2: proxy.user[2],
  user_3: proxy.user[3],
  post_1: proxy.post[1],
  user_len: proxy.user.length,
})

for (let a of proxy.user) {
  for (let b of proxy.user) {
    console.log({ a, b })
  }
}
