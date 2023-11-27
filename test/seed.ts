import { newDB } from 'better-sqlite3-schema'
import { unProxy } from '../src/extension'
import { proxySchema } from '../src/schema-proxy'
import { expect } from 'chai'
import { fromSqliteTimestamp, seedRow } from '../src/helpers'

let db = newDB({
  path: 'data/seed-test.db',
  migrate: {
    migrations: [
      /* sql */ `
-- Up
create table user (
	id integer primary key
, username text
, score integer
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
    score: number
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

seedRow(proxy.user, { username: 'alice' }, { score: 10 })
let row = unProxy(proxy.user[1])
let time0 = Date.now()
assertDate(fromSqliteTimestamp(row.created_at!).getTime(), time0)
assertDate(fromSqliteTimestamp(row.updated_at!).getTime(), time0)
expect(row.username).to.equals('alice')
expect(row.score).to.equals(10)

setTimeout(() => {
  seedRow(proxy.user, { username: 'alice' }, { score: 20 })
  row = unProxy(proxy.user[1])
  let time1 = Date.now()
  assertDate(fromSqliteTimestamp(row.created_at!).getTime(), time0)
  assertDate(fromSqliteTimestamp(row.updated_at!).getTime(), time1)
  expect(row.username).to.equals('alice')
  expect(row.score).to.equals(20)
  console.log('[passed] test/seed.ts')
}, 2000)

function assertDate(a: number, b: number) {
  expect(Math.abs(a - b)).lessThanOrEqual(1000)
}
