import { newDB } from 'better-sqlite3-schema'
import { expect } from 'chai'
import { seedRow, upsert, getId } from '../src/helpers'
import { proxySchema } from '../src/schema-proxy'

describe('select or insert', () => {
  let db = newDB({
    memory: true,
    migrate: {
      migrations: [
        /* sql */ `
-- Up
create table tag (
  id integer primary key
, name text not null unique
);
create table link (
  id integer primary key
, type text not null
, from_id integer not null references tag(id)
, to_id integer not null references tag(id)
);
-- Down
drop table if exists link;
drop table if exists tag;
`,
      ],
    },
  })
  type Tag = {
    id?: number | null
    name: string
  }
  type Link = {
    id?: number | null
    type: string
    from_id: number
    to_id: number
  }
  type DBProxy = {
    tag: Tag[]
    link: Link[]
  }
  let proxy = proxySchema<DBProxy>(db, {
    tag: [],
    link: [],
  })
  beforeEach(() => {
    proxy.link.length = 0
    expect(proxy.link.length).equals(0)

    proxy.tag.length = 0
    expect(proxy.tag.length).equals(0)
  })
  it('seedRow()', () => {
    seedRow(proxy.tag, { name: 'apple' })
    seedRow(proxy.tag, { name: 'apple' })
    seedRow(proxy.tag, { name: 'banana' })
    expect(proxy.tag.length).equals(2)
    expect(proxy.tag[1].name).equals('apple')
    expect(proxy.tag[2].name).equals('banana')

    seedRow(proxy.link, { from_id: 1, to_id: 2 }, { type: 'a' })
    seedRow(proxy.link, { from_id: 1, to_id: 2 }, { type: 'b' })
    seedRow(proxy.link, { from_id: 2, to_id: 1 }, { type: 'c' })
    expect(proxy.link.length).equals(2)

    expect(proxy.link[1].from_id).equals(1)
    expect(proxy.link[1].to_id).equals(2)
    expect(proxy.link[1].type).equals('b')

    expect(proxy.link[2].from_id).equals(2)
    expect(proxy.link[2].to_id).equals(1)
    expect(proxy.link[2].type).equals('c')
  })
  it('upsert()', () => {
    expect(proxy.tag.length).equals(0)
    upsert(proxy.tag, 'name', { name: 'apple' })
    upsert(proxy.tag, 'name', { name: 'apple' })
    upsert(proxy.tag, 'name', { name: 'banana' })
    expect(proxy.tag.length).equals(2)
    expect(proxy.tag[1].name).equals('apple')
    expect(proxy.tag[2].name).equals('banana')

    expect(proxy.link.length).equals(0)
    upsert(proxy.link, 'type', { type: 'a', from_id: 1, to_id: 2 })
    upsert(proxy.link, 'type', { type: 'a', from_id: 1, to_id: 2 })
    upsert(proxy.link, 'type', { type: 'b', from_id: 1, to_id: 2 })
    expect(proxy.link.length).equals(2)
  })
  it('getId()', () => {
    expect(proxy.tag.length).equals(0)
    getId(proxy.tag, 'name', 'apple')
    getId(proxy.tag, 'name', 'apple')
    getId(proxy.tag, 'name', 'banana')
    expect(proxy.tag.length).equals(2)
    expect(proxy.tag[1].name).equals('apple')
    expect(proxy.tag[2].name).equals('banana')
  })
})
