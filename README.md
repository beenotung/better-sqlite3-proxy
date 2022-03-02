# better-sqlite3-proxy

Transparently proxy sqlite tables as a dictionary of arrays

[![npm Package Version](https://img.shields.io/npm/v/better-sqlite3-proxy.svg?maxAge=2592000)](https://www.npmjs.com/package/better-sqlite3-proxy)

## Features
- auto run sqlite statements, supports
  - [x] auto create table
  - [x] insert
  - [x] update
  - [x] select
  - [ ] delete
  - [ ] foreign key reference
  - [ ] auto expand reference objects like [ref-db](https://github.com/beenotung/ref-db)

## Usage Example

```typescript
import DB from 'better-sqlite3-helper'
import { proxyDB } from 'better-sqlite3-proxy'

let db = DB({
  path: 'dev.sqlite3',
  migrate: false,
})

let proxy = proxyDB<{
  users: { username: string }[]
  posts: {
    author: string
    content: string
    created_at: string | Date
  }[]
}>(db)

// auto create users table, then insert record
proxy.users[1] = { username: 'alice' }

// select from users table
let user = proxy.users[1]

// update users table
proxy.users[1] = { username: 'Alice' }
```
