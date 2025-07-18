# better-sqlite3-proxy

Efficiently proxy sqlite tables and access data as typical array of objects.
Powered by [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)🔋

[![npm Package Version](https://img.shields.io/npm/v/better-sqlite3-proxy)](https://www.npmjs.com/package/better-sqlite3-proxy)

## Features

- [x] Type safety support for each table
- [x] support common types of table
  - [x] with schema (e.g. id, user_id, title, content)
  - [x] with json (e.g. id, value)
- [x] auto run sqlite statements, supports:
  - [x] create table (only for key-value proxy)
  - [x] select
  - [x] insert
  - [x] update
  - [x] delete
- [x] auto resolve reference row from foreign key into nested objects like [ref-db](https://github.com/beenotung/ref-db)
- [x] auto convert column values into sqlite3 format
  - [x] convert `true`/`false` to `1`/`0`
  - [x] convert `Date` instance to GMT timestamp
  - [x] support searching `null` / `not null` columns
- [x] extra helper functions:
  - [x] toSqliteTimestamp (date): string
  - [x] fromSqliteTimestamp (string_or_date): Date
  - [x] getTimes (row, fields?): Record<Field, Date | null>
  - [x] seedRow (table, filter, extra?): number
  - [x] upsert (table, key, data): number
  - [x] getId (table, key, value): number | null

### Array Operations Mapping

| Array Operation                 | Mapped SQL Operation                  |
| ------------------------------- | ------------------------------------- |
| `array.push(...object)`         | insert                                |
| `array[id] = object`            | insert or update                      |
| `update(array, id, partial)`    | update                                |
| `find(array, filter)`           | select where filter limit 1           |
| `filter(array, filter)`         | select where filter                   |
| `pick(array, columns, filter?)` | select columns where filter           |
| `count(array, filter)`          | select count where filter             |
| `delete array[id]`              | delete where id                       |
| `del(array, filter)`            | delete where filter                   |
| `array.length = length`         | delete where id > length              |
| `array.slice(start, end)`       | select where id >= start and id < end |

for-of loop, `array.forEach(fn)`, `array.filter(fn)` and `array.map(fn)` are also supported, they will receive proxy-ed rows.

Tips: You can use for-of loop instead of `array.forEach(fn)` if you may terminate the loop early

Tips: You can use `filter(partial)` instead of `array.filter(fn)` for better performance

Tips: You can use `pick(array, columns, filter?)` instead of `array.map(fn)` for better performance

Tips: You can use `update(array, id, partial)` instead of `Object.assign(row, partial)` to update multiple columns in batch

Pro Tips: If you need complex query that can be expressed in sql, use prepared statement will have fastest runtime performance.

### Lazy Evaluation

The results from mapped operations are proxy-ed object identified by id.
Getting the properties on the object will trigger select on corresponding column, and
setting the properties will trigger update on corresponding column.

## Usage Example

Remark: `@beenotung/better-sqlite3-helper` is a fork of `better-sqlite3-helper`. It updates the dependency on better-sqlite3 to v8+ which includes arm64 prebuilds for macOS.

<details>
<summary>Proxy Relational Tables (click to expand)

More Examples in [schema-proxy.spec.ts](./test/schema-proxy.spec.ts)

</summary>

```typescript
import DB from '@beenotung/better-sqlite3-helper'
import { proxySchema, unProxy, find, filter } from 'better-sqlite3-proxy'

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
  user: ['id', 'username'], // specify columns explicitly or leave it empty to auto-scan from create-table schema
  post: [
    ['author', { field: 'user_id', table: 'user' }], // link up reference fields
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
```

</details>

<details>
<summary>Proxy Key-Value Records (click to expand)

More Examples in [key-value.spec.ts](./test/key-value-proxy.spec.ts)

</summary>

```typescript
import DB from '@beenotung/better-sqlite3-helper'
import { proxyKeyValue, find, filter } from 'better-sqlite3-proxy'

export let db = DB({
  path: 'dev.sqlite3',
  migrate: false,
})

type DBProxy = {
  users: {
    id: number
    username: string
  }[]
}

let proxy = proxyKeyValue<DBProxy>(db)

// auto create users table, then insert record
proxy.users[1] = { id: 1, username: 'alice' }
proxy.users.push({ id: 2, username: 'Bob' })

// select from users table
console.log(proxy.users[1]) // { id: 1, username: 'alice' }

// update users table
proxy.users[1] = { id: 1, username: 'Alice' }
console.log(proxy.users[1]) // { id:1, username: 'Alice' }

// find by columns
console.log(find(proxy.users, { username: 'Alice' })?.id) // 1

// filter by columns
console.log(filter(proxy.users, { username: 'Bob' })[0].id) // 2

// delete record
delete proxy.users[2]
console.log(proxy.users.length) // 1

// truncate table
proxy.users.length = 0
console.log(proxy.users.length) // 0
```

</details>

<details>
<summary>Helper Functions Examples (click to expand)

More Examples in [helpers.spec.ts](./test/helpers.spec.ts)

</summary>

```typescript
import DB from '@beenotung/better-sqlite3-helper'
import {
  proxySchema,
  toSqliteTimestamp,
  fromSqliteTimestamp,
  getTimes,
  seedRow,
  getId,
} from 'better-sqlite3-proxy'
import { proxy } from './proxy'

// Timestamp helpers
let timestamp = toSqliteTimestamp(new Date())
console.log(timestamp) // '2024-01-15 10:30:00'

let date = fromSqliteTimestamp(timestamp)
console.log(date) // Date object

// Select timestamps and convert to Date objects (from ISO string in GMT timezone)
let article = proxy.article[1]
let times = getTimes(article, ['created_at', 'updated_at'])
console.log(times.created_at) // Date object

// Update existing row or insert new row
let region_id = seedRow(proxy.region, { code: 'HK' }, { name: 'Hong Kong' })
console.log(region_id) // 1

// Simplified version of seedRow when the table only has one unique key
let tag_id = getId(proxy.hashtag, 'tag', 'linux')
console.log(tag_id) // 1
```

</details>

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
