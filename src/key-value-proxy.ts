import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'
import {
  filterSymbol,
  countSymbol,
  findSymbol,
  unProxySymbol,
  updateSymbol,
} from './extension'
import { filterToKey, notNullPlaceholder } from './internal'

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
    let count_all = db
      .prepare(/* sql */ `select count(*) from ${table}`)
      .pluck()
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
    let select_all_value = db
      .prepare(/* sql */ `select value from ${table}`)
      .pluck()
    let select_by_offset = db.prepare(
      /* sql */ `select value from ${table} limit 1 offset ?`,
    )

    let select_last_id = db
      .prepare(/* sql */ `select max(id) from ${table}`)
      .pluck()

    function push(): number {
      let last_id: number = 0
      for (let i = 0; i < arguments.length; i++) {
        last_id = insert_without_id.run(encode(arguments[i]))
          .lastInsertRowid as number
      }
      return last_id || (select_last_id.get() as number)
    }

    function* iterator() {
      for (let offset = 0; ; offset++) {
        let row = select_by_offset.get(offset) as { value: string }
        if (row) {
          yield decode(row.value)
        } else {
          break
        }
      }
    }

    type KeyValue = { id: number; value: string }
    let select_all = db.prepare(/* sql */ `select id, value from ${table}`)

    function forEach(
      callbackfn: (value: Row<Name>, index: number, array: Row<Name>[]) => void,
    ): void {
      const rows = select_all.all() as KeyValue[]
      const n = rows.length
      let i: number
      let row: KeyValue
      for (i = 0; i < n; i++) {
        row = rows[i]
        callbackfn(decode(row.value), row.id, proxy)
      }
    }

    function map<U>(
      callbackfn: (value: Row<Name>, index: number, array: Row<Name>[]) => U,
    ): U[] {
      const results = select_all.all() as any[]
      const n = results.length
      let i: number
      let row: KeyValue
      for (i = 0; i < n; i++) {
        row = results[i]
        results[i] = callbackfn(decode(row.value), row.id, proxy)
      }
      return results
    }

    function arrayFilter(
      callbackfn: (
        value: Row<Name>,
        index: number,
        array: Row<Name>[],
      ) => boolean,
    ): Row<Name>[] {
      const rows = select_all.all() as KeyValue[]
      const n = rows.length
      const results: Row<Name>[] = []
      let i: number
      let row: KeyValue
      let value: Row<Name>
      for (i = 0; i < n; i++) {
        row = rows[i]
        value = decode(row.value)
        if (callbackfn(value, row.id, proxy)) {
          results.push(value)
        }
      }
      return results
    }

    let slice_0 = select_all_value
    let slice_1 = db
      .prepare(/* sql */ `select value from ${table} where id >= :start`)
      .pluck()
    let slice_2 = db
      .prepare(
        /* sql */ `select value from ${table} where id >= :start and id < :end`,
      )
      .pluck()
    function slice(start?: number, end?: number): Row<Name>[] {
      let args = arguments.length
      const results = (
        args == 0
          ? slice_0.all()
          : args == 1
          ? slice_1.all({ start })
          : slice_2.all({ start, end })
      ) as any[]
      const n = results.length
      let i: number
      for (i = 0; i < n; i++) {
        results[i] = decode(results[i])
      }
      return results
    }

    let find_dict: Record<string, Statement> = {}
    function find(filter: Partial<Row<Name>>): Row<Name> | undefined {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('find() expects non-empty filter')
      }
      let key = filterToKey(filter)
      let select =
        find_dict[key] ||
        (find_dict[key] = db
          .prepare(
            /* sql */ `select value from ${table} where ${keys
              .map(key => toWhereCondition(filter, key))
              .join(' and ')} limit 1`,
          )
          .pluck())
      return decode(select.get(filter) as string)
    }

    let filter_dict: Record<string, Statement> = {}
    function filter(filter: Partial<Row<Name>>): Array<Row<Name>> {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('filter() expects non-empty filter')
      }
      let key = filterToKey(filter)
      let select =
        filter_dict[key] ||
        (filter_dict[key] = db
          .prepare(
            /* sql */ `select value from ${table} where ${keys
              .map(key => toWhereCondition(filter, key))
              .join(' and ')}`,
          )
          .pluck())
      let rows = select.all(filter) as string[]
      return rows.map(decode)
    }

    let count_dict: Record<string, Statement> = {}
    function count(filter: Partial<Row<Name>>): number {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('count() expects non-empty filter')
      }
      let key = filterToKey(filter)
      let select =
        count_dict[key] ||
        (count_dict[key] = db
          .prepare(
            /* sql */ `select count(*) from ${table} where ${keys
              .map(key => toWhereCondition(filter, key))
              .join(' and ')}`,
          )
          .pluck())
      return select.get(filter) as number
    }

    function partialUpdate(id: number, partial: Partial<Row<Name>>) {
      if (count_by_id.get(id) == 1) {
        let value = decode(select_by_id.get(id) as string)
        let json = encode({ ...value, ...partial })
        update.run({ id, value: json })
      }
    }

    let proxy = new Proxy([] as unknown[] as Table, {
      has(target, p) {
        switch (p) {
          case unProxySymbol:
          case findSymbol:
          case filterSymbol:
          case countSymbol:
          case updateSymbol:
          case Symbol.iterator:
          case 'length':
          case 'forEach':
          case 'map':
          case 'filter':
          case 'slice':
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
            return (select_all_value.all() as string[]).map(decode)
          case findSymbol:
            return find
          case filterSymbol:
            return filter
          case countSymbol:
            return count
          case updateSymbol:
            return partialUpdate
          case Symbol.iterator:
            return iterator
          case 'length':
            return count_all.get()
          case 'forEach':
            return forEach
          case 'map':
            return map
          case 'filter':
            return arrayFilter
          case 'slice':
            return slice
          case 'push':
            return push
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return decode(select_by_id.get(id) as string)
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

function toWhereCondition<Filter>(filter: Filter, key: string & keyof Filter) {
  let value = filter[key]
  return value === null
    ? `json_extract(value,'$.${key}') is null`
    : value === notNullPlaceholder
    ? `json_extract(value,'$.${key}') is not null`
    : `json_extract(value,'$.${key}') = :${key}`
}
