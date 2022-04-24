import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'
import { filterSymbol, findSymbol, unProxySymbol } from './extension'

export function proxyKeyValue<Dict extends { [table: string]: object[] }>(
  db: DBInstance,
): Dict {
  type TableName = keyof Dict
  type Row<Name extends TableName> = Dict[Name][number]
  let tableProxyMap = new Map<string, Dict[TableName]>()
  function encode(object: object) {
    return JSON.stringify(object)
  }
  function decode(json: string | undefined) {
    if (json) {
      return JSON.parse(json)
    }
  }
  function proxyTable<Name extends TableName>(table: string): Dict[Name] {
    type Table = Dict[Name]
    if (tableProxyMap.has(table)) {
      return tableProxyMap.get(table) as Table
    }
    db.exec(/* sql */ `
create table if not exists ${table} (
  id integer primary key
, value json
)`)
    let select_by_id = db
      .prepare(/* sql */ `select value from ${table} where id = ?`)
      .pluck()
    let count = db.prepare(/* sql */ `select count(*) from ${table}`).pluck()
    let delete_by_id = db.prepare(/* sql */ `delete from ${table} where id = ?`)
    let delete_by_length = db.prepare(
      /* sql */ `delete from ${table} where id > ?`,
    )
    let update = db.prepare(
      /* sql */ `update ${table} set value = :value where id = :id`,
    )
    let insert_with_id = db.prepare(
      /* sql */ `insert into ${table} (id, value) values (:id,:value)`,
    )
    let insert_without_id = db.prepare(
      /* sql */ `insert into ${table} (value) values (?)`,
    )
    let count_by_id = db
      .prepare(/* sql */ `select count(*) from ${table} where id = ?`)
      .pluck()
    let select_all = db.prepare(/* sql */ `select value from ${table}`).pluck()
    let select_by_offset = db.prepare(
      /* sql */ `select value from ${table} limit 1 offset ?`,
    )

    function push(): number {
      for (let i = 0; i < arguments.length; i++) {
        insert_without_id.run(encode(arguments[i]))
      }
      return count.get()
    }

    function* iterator() {
      for (let offset = 0; ; offset++) {
        let row = select_by_offset.get(offset)
        if (row) {
          yield decode(row.value)
        } else {
          break
        }
      }
    }

    let find_dict: Record<string, Statement> = {}
    function find(filter: Partial<Row<Name>>): Row<Name> | undefined {
      let keys = Object.keys(filter)
      if (keys.length === 0) {
        throw new Error('find() expects non-empty filter')
      }
      let key = keys.join('|')
      let select =
        find_dict[key] ||
        (find_dict[key] = db
          .prepare(
            /* sql */ `select value from ${table} where ${keys
              .map(key => `json_extract(value, '$.${key}') = :${key}`)
              .join(' and ')} limit 1`,
          )
          .pluck())
      return decode(select.get(filter))
    }

    let filter_dict: Record<string, Statement> = {}
    function filter(filter: Partial<Row<Name>>): Array<Row<Name>> {
      let keys = Object.keys(filter)
      if (keys.length === 0) {
        throw new Error('filter() expects non-empty filter')
      }
      let key = keys.join('|')
      let select =
        filter_dict[key] ||
        (filter_dict[key] = db
          .prepare(
            /* sql */ `select value from ${table} where ${keys
              .map(key => `json_extract(value,'$.${key}') = :${key}`)
              .join(' and ')}`,
          )
          .pluck())
      return select.all(filter).map(decode)
    }

    let proxy = new Proxy([] as unknown[] as Table, {
      has(target, p) {
        switch (p) {
          case unProxySymbol:
          case findSymbol:
          case filterSymbol:
          case Symbol.iterator:
          case 'length':
          case 'push':
            return true
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return count_by_id.get(id) === 1
          }
        }
        return Reflect.has(target, p)
      },
      set(target, p, value, receiver) {
        if (p === 'length') {
          delete_by_length.run(value)
          return true
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            let json = encode(value)
            if (count_by_id.get(id) === 1) {
              update.run({ id, value: json })
            } else {
              insert_with_id.run({ id, value: json })
            }
            return true
          }
        }
        return Reflect.set(target, p, value, receiver)
      },
      get(target, p, receiver) {
        switch (p) {
          case unProxySymbol:
            return select_all.all().map(decode)
          case findSymbol:
            return find
          case filterSymbol:
            return filter
          case Symbol.iterator:
            return iterator
          case 'length':
            return count.get()
          case 'push':
            return push
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return decode(select_by_id.get(id))
          }
        }
        return Reflect.get(target, p, receiver)
      },
      deleteProperty(target, p) {
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            delete_by_id.run(id)
            return true
          }
        }
        return Reflect.deleteProperty(target, p)
      },
    })
    tableProxyMap.set(table, proxy)
    return proxy
  }
  return new Proxy({} as Dict, {
    get(target, propertyKey, receiver) {
      if (typeof propertyKey === 'string') {
        return proxyTable(propertyKey)
      }
      return Reflect.get(target, propertyKey, receiver)
    },
  })
}
