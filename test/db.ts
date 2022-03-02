import DB from 'better-sqlite3-helper'
import { toSafeMode } from 'better-sqlite3-schema'
import { join } from 'path'
import { proxyDB } from '../src/proxy'

export let db = DB({
  path: join('data', 'sqlite3.db'),
  migrate: false,
})

toSafeMode(db)

let proxy = proxyDB<{
  users: { username: string }[]
  posts: {
    user_id: number
    content: string
    created_at: string | Date
  }[]
}>(db)

proxy.users[1] = { username: 'alice' }
if (proxy.users.length < 2) {
  proxy.users[2] = { username: 'bob' }
}
proxy.posts[1] = {
  content: 'hello world',
  created_at: new Date(),
  user_id: 1,
}
// proxy.users[0] = { username: 'zero' }

console.log({
  user_1: proxy.users[1],
  user_2: proxy.users[2],
  user_3: proxy.users[3],
  post_1: proxy.posts[1],
  user_len: proxy.users.length,
})

for (let a of proxy.users) {
  for (let b of proxy.users) {
    console.log({ a, b })
  }
}
