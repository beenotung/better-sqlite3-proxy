import DB from '@beenotung/better-sqlite3-helper'
import { proxyKeyValue, find, filter } from '../src'

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
