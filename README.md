# better-sqlite3-proxy

Efficiently proxy sqlite tables and access data as typical array of objects.

[![npm Package Version](https://img.shields.io/npm/v/better-sqlite3-proxy)](https://www.npmjs.com/package/better-sqlite3-proxy)
[![npm Package Version](https://img.shields.io/bundlephobia/min/better-sqlite3-proxy)](https://bundlephobia.com/package/better-sqlite3-proxy)
[![npm Package Version](https://img.shields.io/bundlephobia/minzip/better-sqlite3-proxy)](https://bundlephobia.com/package/better-sqlite3-proxy)

## Features

- auto run sqlite statements, supports:
  - [x] create table (only for key-value proxy)
  - [x] select
  - [x] insert
  - [x] update
  - [x] delete
- [ ] auto expand foreign key reference into nested objects like [ref-db](https://github.com/beenotung/ref-db)

### Array Operations Mapping

| Array Operation       | Mapped SQL Operation        |
| --------------------- | --------------------------- |
| array.push            | insert                      |
| array[id] = object    | insert or update            |
| find(array, filter)   | select where filter limit 1 |
| filter(array, filter) | select where filter         |
| delete array[id]      | delete                      |
| array.length = 0      | delete where id > length    |

### Lazy Evaluation

The results from mapped operations are proxy-ed object identified by id.
Getting the properties on the object will trigger select on corresponding column, and
setting the properties will trigger update on corresponding column.

## Usage Example

<details>
<summary>Proxy Relational Tables (click to expand)

More Examples in [schema-proxy.spec.ts](./test/schema-proxy.spec.ts)

</summary>

```typescript
import DB from 'better-sqlite3-helper'
import { proxyDB } from 'better-sqlite3-proxy'

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
}

let proxy = proxySchema<DBProxy>(db, {
  user: ['id', 'username'],
  post: ['id', 'user_id', 'content', 'created_at'],
})

// insert record
proxy.user[1] = { username: 'alice' }
proxy.user.push({ username: 'Bob' })
proxy.post.push({ user_id: 1, content: 'Hello World' })

// select a specific column
console.log(proxy.user[1].username) // 'alice'

// select all columns of a record
console.log(unProxy(proxy.post[1])) // { id: 1, user_id: 1, content: 'Hello World', created_at: '2022-04-21 23:30:00'}

// update a specific column
proxy.user[1].username = 'Alice'

// update multiple columns
proxy.post[1] = { content: 'Hello Sqlite', created_at: '2022-04-22 08:30:00' }

// delete record
delete proxy.user[2]
console.log(proxy.user.length) // 1

// truncate table
proxy.users.length = 0
console.log(proxy.users.length) // 0
```

</details>

<details>
<summary>Proxy Key-Value Records (click to expand)

More Examples in [key-value.spec.ts](./test/key-value-proxy.spec.ts)

</summary>

```typescript
import DB from 'better-sqlite3-helper'
import { proxyDB } from 'better-sqlite3-proxy'

export let db = DB({
  path: 'dev.sqlite3',
  migrate: false,
})

type DBProxy = {
  users: {
    username: string
  }[]
}

let proxy = proxyKeyValue<DBProxy>(db)

// auto create users table, then insert record
proxy.users[1] = { username: 'alice' }
proxy.users.push({ username: 'Bob' })

// select from users table
console.log(proxy.users[2]) // { username: 'Bob' }

// update users table
proxy.users[1] = { username: 'Alice' }
console.log(proxy.users[1]) // { username: 'Alice' }

// delete record
delete proxy.users[2]
console.log(proxy.users.length) // 1

// truncate table
proxy.users.length = 0
console.log(proxy.users.length) // 0
```

</details>

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
