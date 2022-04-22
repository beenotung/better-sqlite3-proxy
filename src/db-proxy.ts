import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'

export function proxyDB<Dict extends { [table: string]: object[] }>(
  db: DBInstance,
  tableFields: Record<keyof Dict, string[]>,
): Dict {
  type TableName = keyof Dict
  type Row<Name extends TableName> = Dict[Name][number]
  let tableProxyMap = new Map<string, Dict[TableName]>()

  function proxyTable<Name extends TableName>(
    table: string,
    fields: string[],
  ): Dict[Name] {
    type Table = Dict[Name]
    if (tableProxyMap.has(table)) {
      return tableProxyMap.get(table) as Table
    }
    let rowProxyMap = new Map<number, Row<Name>>()

    let select_column_dict: Record<string, Statement> = {}
    for (let field of fields) {
      select_column_dict[field] = db
        .prepare(/* sql */ `select ${field} from ${table} where id = ?`)
        .pluck()
    }

    let count = db.prepare(/* sql */ `select count(*) from ${table}`).pluck()
    let delete_by_length = db.prepare(
      /* sql */ `delete from ${table} where id >= ?`,
    )

    let update_dict: Record<string, Statement> = {}
    let update_run = (id: number, row: Record<string, any>) => {
      let keys = Object.keys(row)
      if (keys.length == 0) return
      let key = keys.join('|')
      let update =
        update_dict[key] ||
        (update_dict[key] = db.prepare(
          /* sql */ `update ${table} set ${keys} where id = :id`,
        ))
      update.run(row)
    }

    let insert_empty = db.prepare(
      /* sql */ `insert into ${table} (id) values (null)`,
    )

    let insert_dict: Record<string, Statement> = {}
    let insert_run = (row: Record<string, any>) => {
      let keys = Object.keys(row)
      if (keys.length) {
        insert_empty.run()
        return
      }
      let key = keys.join('|')
      let insert =
        insert_dict[key] ||
        (insert_dict[key] = db.prepare(
          /* sql */ `insert into ${table} (${keys}) values (${keys.map(
            key => ':' + key,
          )})`,
        ))
      insert.run(row)
    }

    let count_by_id = db
      .prepare(/* sql */ `select count(*) from ${table} where id = ?`)
      .pluck()

    let select_id = db.prepare(/* sql */ `select id from ${table}`).pluck()

    let proxy = new Proxy([] as unknown[] as Table, {
      has(target, p) {
        console.log('has:', p)
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return count_by_id.get(id) === 1
          }
        }
        return Reflect.has(target, p)
      },
      set(target, p, value, receiver) {
        console.log('set:', p)
        if (p === 'length') {
          delete_by_length.run(value)
          return true
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            if (count_by_id.get(id) === 1) {
              update_run(id, value)
            } else {
              insert_run({ id, ...value })
            }
            return true
          }
        }
        return Reflect.set(target, p, value, receiver)
      },
      get(target, p, receiver) {
        console.log('get:', p)
        if (p === 'length') {
          return count.get()
        }
        if (p === 'push') {
          return function () {
            for (let i = 0; i < arguments.length; i++) {
              insert_run(arguments[i])
            }
            return count.get()
          }
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            return proxyRow(table, rowProxyMap, id)
          }
        }
        if (p === Symbol.iterator) {
          return function* () {
            for (let id of select_id.all()) {
              yield proxyRow(table, rowProxyMap, id)
            }
          }
        }
        return Reflect.get(target, p, receiver)
      },
    })
    tableProxyMap.set(table, proxy)
    return proxy
  }
  function proxyRow<Name extends TableName>(
    table: string,
    rowProxyMap: Map<number, Row<Name>>,
    id: number,
  ): Row<Name> {
    if (rowProxyMap.has(id)) {
      return rowProxyMap.get(id)
    }

    let proxy = new Proxy({} as unknown as Row<Name>, {
      set(target, p, value, receiver) {
        console.log('row.set:', p, value)
        return Reflect.set(target, p, value, receiver)
      },
      get(target, p, receiver) {
        console.log('row.get:', p)
        return Reflect.get(target, p, receiver)
      },
    })
    rowProxyMap.set(id, proxy)
    return proxy
  }
  let table_dict = {} as Dict
  for (let table in tableFields) {
    let fields = tableFields[table]
    table_dict[table] = proxyTable(table, fields)
  }
  return table_dict
}
