import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'
import { unProxySymbol } from './extension'

export function proxySchema<Dict extends { [table: string]: object[] }>(
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

    let select_one_column_dict: Record<string, Statement> = {}
    for (let field of fields) {
      select_one_column_dict[field] = db
        .prepare(/* sql */ `select ${field} from ${table} where id = ?`)
        .pluck()
    }
    let select_all_column_by_id = db.prepare(
      /* sql */ `select * from ${table} where id = ? limit 1`,
    )
    let select_all = db.prepare(/* sql */ `select * from ${table}`)

    let count = db.prepare(/* sql */ `select count(*) from ${table}`).pluck()

    let delete_by_id = db.prepare(/* sql */ `delete from ${table} where id = ?`)
    let delete_by_length = db.prepare(
      /* sql */ `delete from ${table} where id > ?`,
    )

    let update_dict: Record<string, Statement> = {}
    let update_run = (id: number, row: Record<string, any>) => {
      let keys = Object.keys(row)
      if (keys.length == 0) return
      let key = keys.join('|')
      let update =
        update_dict[key] ||
        (update_dict[key] = db.prepare(
          /* sql */ `update ${table} set ${keys.map(
            key => `${key} = :${key}`,
          )} where id = :id`,
        ))
      update.run(row)
    }

    let update_one_column_dict: Record<string, Statement> = {}
    for (let field of fields) {
      update_one_column_dict[field] = db.prepare(
        /* sql */ `update ${table} set ${field} = :${field} where id = :id`,
      )
    }

    let insert_empty = db.prepare(
      /* sql */ `insert into ${table} (id) values (null)`,
    )

    let insert_dict: Record<string, Statement> = {}
    let insert_run = (row: Record<string, any>) => {
      let keys = Object.keys(row)
      if (keys.length === 0) {
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
      .prepare(/* sql */ `select count(*) from ${table} where id = ? limit 1`)
      .pluck()

    let select_id = db.prepare(/* sql */ `select id from ${table}`).pluck()

    function push() {
      for (let i = 0; i < arguments.length; i++) {
        insert_run(arguments[i])
      }
      return count.get()
    }

    function proxyRow<Name extends TableName>(id: number): Row<Name> {
      let proxy = rowProxyMap.get(id)
      if (proxy) {
        return rowProxyMap.get(id)!
      }
      proxy = new Proxy({} as Row<Name>, {
        has(target, p) {
          return (
            p === unProxySymbol ||
            (typeof p === 'string' && fields.includes(p)) ||
            Reflect.has(target, p)
          )
        },
        set(target, p, value, receiver) {
          if (typeof p === 'string' && fields.includes(p)) {
            update_one_column_dict[p].run({ id, [p]: value })
            return true
          }
          return Reflect.set(target, p, value, receiver)
        },
        get(target, p, receiver) {
          if (p === unProxySymbol) {
            return select_all_column_by_id.get(id)
          }
          if (typeof p === 'string' && fields.includes(p)) {
            return select_one_column_dict[p].get(id)
          }
          return Reflect.get(target, p, receiver)
        },
      })
      rowProxyMap.set(id, proxy)
      return proxy
    }

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
        if (p === 'length') {
          return count.get()
        }
        if (p === 'push') {
          return push
        }
        if (p === unProxySymbol) {
          return select_all.all()
        }
        if (typeof p !== 'symbol') {
          let id = +p
          if (Number.isInteger(id)) {
            if (count_by_id.get(id) === 1) {
              return proxyRow(id)
            }
            return undefined // this row doesn't exist
          }
        }
        if (p === Symbol.iterator) {
          return function* () {
            for (let id of select_id.all()) {
              yield proxyRow(id)
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

  let table_dict = {} as Dict
  for (let table in tableFields) {
    let fields = tableFields[table]
    table_dict[table] = proxyTable(table, fields)
  }
  return table_dict
}
