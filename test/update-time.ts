import { newDB } from 'better-sqlite3-schema'
import { unProxy } from '../src/extension'
import { proxySchema } from '../src/schema-proxy'

let db = newDB({
  path: 'data/update-test.db',
  migrate: {
    migrations: [
      /* sql */ `
-- Up
create table user (
	id integer primary key
, username text
, created_at timestamp default current_timestamp
, updated_at timestamp default current_timestamp
);
-- Down
`,
    ],
  },
})

type DBProxy = {
  user: {
    id?: number
    username: string
    created_at?: string
    updated_at?: string
  }[]
}

let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    user: [],
  },
})

console.log('0', unProxy(proxy.user[1]))

proxy.user[1] = { username: 'Alice' }
console.log('1', unProxy(proxy.user[1]))

setTimeout(() => {
  proxy.user[1].username = 'Alice2'
  console.log('2', unProxy(proxy.user[1]))
}, 2000)
