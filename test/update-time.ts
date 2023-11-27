import { newDB } from 'better-sqlite3-schema'
import { unProxy } from '../src/extension'
import { proxySchema } from '../src/schema-proxy'
import { expect } from 'chai'
import { fromSqliteTimestamp } from '../src/helpers'

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

delete proxy.user[1]
proxy.user[1] = { username: 'Alice0' }
let row = unProxy(proxy.user[1])
let time0 = Date.now()
assertDate(fromSqliteTimestamp(row.created_at!).getTime(), time0)
assertDate(fromSqliteTimestamp(row.updated_at!).getTime(), time0)

setTimeout(() => {
  proxy.user[1].username = 'Alice1'
  row = unProxy(proxy.user[1])
  let time1 = Date.now()
  assertDate(fromSqliteTimestamp(row.created_at!).getTime(), time0)
  assertDate(fromSqliteTimestamp(row.updated_at!).getTime(), time1)
  console.log('[passed] test/update-time.ts')
}, 2000)

function assertDate(a: number, b: number) {
  expect(Math.abs(a - b)).lessThanOrEqual(800)
}
