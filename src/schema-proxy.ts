import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'
import { unProxySymbol, findSymbol, filterSymbol } from './extension'

export type TableField = string | RelationField

export type RelationField = [
  name: string,
  references: { field: string; table: string },
]

export function proxySchema<Dict extends { [table: string]: object[] }>(
  db: DBInstance,
  tableFields: Record<keyof Dict, TableField[]>,
): Dict {
  type TableName = keyof Dict
  type Row<Name extends TableName> = Dict[Name][number]
  let tableProxyMap = new Map<string, Dict[TableName]>()

  let tableProxyRowDict: Record<string, (id: number) => Row<TableName>> = {}

  function proxyTable<Name extends TableName>(
    table: string,
    tableFieldNames: string[],
    relationFields: RelationField[],
  ): Dict[Name] {
    type Table = Dict[Name]
    if (tableProxyMap.has(table)) {
      return tableProxyMap.get(table) as Table
    }
    let rowProxyMap = new Map<number, Row<Name>>()

    let relationFieldNames: string[] = relationFields.map(([field]) => field)
    let relationFieldDict = Object.fromEntries(relationFields)

    let select_one_column_dict: Record<string, Statement> = {}
    for (let field of tableFieldNames) {
      select_one_column_dict[field] = db
        .prepare(/* sql */ `select ${field} from ${table} where id = ?`)
        .pluck()
    }
    let select_all_column_by_id = db.prepare(
      /* sql */ `select * from ${table} where id = ? limit 1`,
    )
    let select_all = db.prepare(/* sql */ `select * from ${table}`)

    let count = db.prepare(/* sql */ `select count(*) from ${table}`).pluck()

    let select_last_id = db
      .prepare(/* sql */ `select max(id) from ${table}`)
      .pluck()

    let delete_by_id = db.prepare(/* sql */ `delete from ${table} where id = ?`)
    let delete_by_length = db.prepare(
      /* sql */ `delete from ${table} where id > ?`,
    )

    let update_dict: Record<string, Statement> = {}
    let update_run = (id: number, row: Record<string, any>) => {
      let params: Record<string, any> = { id }
      let keys: string[] = []
      for (let key in row) {
        if (tableFieldNames.includes(key)) {
          keys.push(key)
          params[key] = row[key]
        } else if (relationFieldNames.includes(key)) {
          let field = relationFieldDict[key].field
          keys.push(field)
          params[field] = row[key].id
        }
      }
      if (keys.length == 0) return
      let key = keys.join('|')
      let update =
        update_dict[key] ||
        (update_dict[key] = db.prepare(
          /* sql */ `update ${table} set ${keys.map(
            key => `${key} = :${key}`,
          )} where id = :id`,
        ))
      update.run(params)
    }

    let update_one_column_dict: Record<string, Statement> = {}
    for (let field of tableFieldNames) {
      update_one_column_dict[field] = db.prepare(
        /* sql */ `update ${table} set ${field} = :${field} where id = :id`,
      )
    }

    let insert_empty = db.prepare(
      /* sql */ `insert into ${table} (id) values (null)`,
    )

    let insert_dict: Record<string, Statement> = {}
    let insert_run = (row: Record<string, any>): number => {
      let keys = Object.keys(row)
      if (keys.length === 0) {
        return insert_empty.run().lastInsertRowid as number
      }
      let key = keys.join('|')
      let insert =
        insert_dict[key] ||
        (insert_dict[key] = db.prepare(
          /* sql */ `insert into ${table} (${keys}) values (${keys.map(
            key => ':' + key,
          )})`,
        ))
      return insert.run(row).lastInsertRowid as number
    }

    let count_by_id = db
      .prepare(/* sql */ `select count(*) from ${table} where id = ? limit 1`)
      .pluck()

    let select_id = db.prepare(/* sql */ `select id from ${table}`).pluck()

    function* iterator() {
      for (let id of select_id.all()) {
        yield proxyRow(id)
      }
    }

    function push(): number {
      let last_id: number = 0
      for (let i = 0; i < arguments.length; i++) {
        last_id = insert_run(arguments[i])
      }
      return last_id || select_last_id.get()
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
            /* sql */ `select id from ${table} where ${keys
              .map(key => `${key} = :${key}`)
              .join(' and ')} limit 1`,
          )
          .pluck())
      let id = select.get(filter)
      return id ? proxyRow(id) : undefined
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
            /* sql */ `select id from ${table} where ${keys
              .map(key => `${key} = :${key}`)
              .join(' and ')}`,
          )
          .pluck())
      return select.all(filter).map(proxyRow)
    }

    let proxyRow = <Name extends TableName>(id: number): Row<Name> => {
      let proxy = rowProxyMap.get(id)
      if (proxy) {
        return rowProxyMap.get(id)!
      }
      proxy = new Proxy({} as Row<Name>, {
        has(target, p) {
          return (
            p === unProxySymbol ||
            (typeof p === 'string' &&
              (tableFieldNames.includes(p) ||
                relationFieldNames.includes(p))) ||
            Reflect.has(target, p)
          )
        },
        set(target, p, value, receiver) {
          if (p === 'id') {
            throw new Error('cannot update id')
          }
          if (typeof p === 'string') {
            if (tableFieldNames.includes(p)) {
              update_one_column_dict[p].run({ id, [p]: value })
              return true
            }
            if (relationFieldNames.includes(p)) {
              let field: string = relationFieldDict[p].field
              update_one_column_dict[field].run({ id, [field]: value.id })
              return true
            }
          }
          return Reflect.set(target, p, value, receiver)
        },
        get(target, p, receiver) {
          if (p === unProxySymbol) {
            return select_all_column_by_id.get(id)
          }
          if (p === 'id') {
            return id
          }
          if (typeof p === 'string') {
            if (tableFieldNames.includes(p)) {
              return select_one_column_dict[p].get(id)
            }
            if (relationFieldNames.includes(p)) {
              let relationField = relationFieldDict[p]
              let proxyRow = tableProxyRowDict[relationField.table]
              let foreign_id =
                select_one_column_dict[relationField.field].get(id)
              return proxyRow(foreign_id)
            }
          }
          return Reflect.get(target, p, receiver)
        },
      })
      rowProxyMap.set(id, proxy)
      return proxy
    }
    tableProxyRowDict[table] = proxyRow

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
        switch (p) {
          case unProxySymbol:
            return select_all.all()
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
            if (count_by_id.get(id) === 1) {
              return proxyRow(id)
            }
            return undefined // this row doesn't exist
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
    let _tableFields: string[] = []
    let _relationFields: RelationField[] = []
    for (let field of fields) {
      if (typeof field === 'string') {
        _tableFields.push(field)
      } else {
        _relationFields.push(field)
      }
    }
    table_dict[table] = proxyTable(table, _tableFields, _relationFields)
  }
  return table_dict
}
