import { DBInstance } from 'better-sqlite3-schema'
import { unProxySymbol } from './extension'

export function proxyKeyValue<Dict extends { [table: string]: object[] }>(
  db: DBInstance,
): Dict {
  type TableName = keyof Dict
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
    let proxy = new Proxy([] as unknown[] as Table, {
      has(target, p) {
        if (p === unProxySymbol) {
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
        if (p === unProxySymbol) {
          return select_all.all().map(decode)
        }
        if (p === 'length') {
          return count.get()
        }
        if (p === 'push') {
          return function () {
            for (let i = 0; i < arguments.length; i++) {
              insert_without_id.run(encode(arguments[i]))
            }
            return count.get()
          }
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return decode(select_by_id.get(id))
          }
        }
        if (p === Symbol.iterator) {
          return function* () {
            for (let offset = 0; ; offset++) {
              let row = select_by_offset.get(offset)
              if (row) {
                yield decode(row.value)
              } else {
                break
              }
            }
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
