import DB from 'better-sqlite3-helper'
import { join } from 'path'
import { proxyKeyValueDB } from '../src/key-value-proxy'

export let db = DB({
  path: join('data', 'sqlite3.db'),
  migrate: false,
})

let proxy = proxyKeyValueDB<{
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
