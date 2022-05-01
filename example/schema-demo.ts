import DB from 'better-sqlite3-helper'
import { proxySchema, unProxy, find, filter } from '../src'

let db = DB({
  path: 'dev.sqlite3',
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

type DBProxy = {
  user: User[]
  post: Post[]
}
type User = {
  id?: number
  username: string
}
type Post = {
  id?: number
  user_id: number
  content: string
  created_at?: string
  author?: User
}

let proxy = proxySchema<DBProxy>(db, {
  user: ['id', 'username'],
  post: [
    'id',
    'user_id',
    'content',
    'created_at',
    ['author', { field: 'user_id', table: 'user' }],
  ],
})

// insert record
proxy.user[1] = { username: 'alice' }
proxy.user.push({ username: 'Bob' })
proxy.post.push({ user_id: 1, content: 'Hello World' })

// select a specific column
console.log(proxy.user[1].username) // 'alice'

// select a specific column from reference table
console.log(proxy.post[1].author?.username) // 'alice'

// select all columns of a record
console.log(unProxy(proxy.post[1])) // { id: 1, user_id: 1, content: 'Hello World', created_at: '2022-04-21 23:30:00'}

// update a specific column
proxy.user[1].username = 'Alice'

// update multiple columns
proxy.post[1] = {
  content: 'Hello SQLite',
  created_at: '2022-04-22 08:30:00',
} as Partial<Post> as Post

// find by columns
console.log(find(proxy.user, { username: 'Alice' })?.id) // 1

// filter by columns
console.log(filter(proxy.post, { user_id: 1 })[0].content) // 'Hello SQLite

// delete record
delete proxy.user[2]
console.log(proxy.user.length) // 1

// truncate table
proxy.post.length = 0
console.log(proxy.post.length) // 0