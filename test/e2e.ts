import { expect } from 'chai'
import { unProxy } from '../src/schema-proxy'

export type DBProxy = {
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

export function e2eTest(proxy: DBProxy) {
  it('should reset table', () => {
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
  })
  it('should insert row by push', () => {
    proxy.user.push({ username: 'Alice' })
    expect(proxy.user.length).to.equals(1)
  })
  it('should select row by id', () => {
    expect(unProxy(proxy.user[1])).to.deep.equals({ id: 1, username: 'Alice' })
  })
  it('should insert row by array index', () => {
    proxy.user[2] = { username: 'Bob' }
    expect(unProxy(proxy.user[2])).to.deep.equals({ id: 2, username: 'Bob' })
  })
  it('should update row', () => {
    proxy.user[2].username = 'Charlie'
    expect(unProxy(proxy.user[2])).to.deep.equals({
      id: 2,
      username: 'Charlie',
    })
  })
  it('should select column', () => {
    expect(proxy.user[2].username).to.equals('Charlie')
  })
  it('should select all rows', () => {
    expect(unProxy(proxy.user)).to.deep.equals([
      { id: 1, username: 'Alice' },
      { id: 2, username: 'Charlie' },
    ])
  })
  it('should truncate table', () => {
    expect(proxy.user.length).not.equals(0)
    proxy.user.length = 0
    expect(proxy.user.length).to.equals(0)
    expect(proxy.user[1]).to.be.undefined
    expect(proxy.user[2]).to.be.undefined
  })
}
