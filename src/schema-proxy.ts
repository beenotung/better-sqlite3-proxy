import { Statement } from 'better-sqlite3'
import { DBInstance } from 'better-sqlite3-schema'
import {
  unProxySymbol,
  findSymbol,
  filterSymbol,
  countSymbol,
  updateSymbol,
} from './extension'
import { parseCreateTable } from 'quick-erd/dist/db/sqlite-parser'
import { toSqliteTimestamp } from './helpers'

export type TableField = string | RelationField

export type RelationField = [
  name: string,
  references: { field: string; table: string },
]

export type ProxySchemaOptions<Dict extends { [table: string]: object[] }> = {
  db: DBInstance
  tableFields: Record<keyof Dict, TableField[]>
  auto_update_timestamp?: boolean // default: true
}

export function proxySchema<Dict extends { [table: string]: object[] }>(
  db: DBInstance,
  tableFields: Record<keyof Dict, TableField[]>,
): Dict
export function proxySchema<Dict extends { [table: string]: object[] }>(
  options: ProxySchemaOptions<Dict>,
): Dict
export function proxySchema<Dict extends { [table: string]: object[] }>(
  db_or_options: DBInstance | ProxySchemaOptions<Dict>,
  tableFields?: Record<keyof Dict, TableField[]>,
): Dict {
  let options: ProxySchemaOptions<Dict>
  if (tableFields) {
    options = {
      db: db_or_options as DBInstance,
      tableFields,
    }
  } else {
    options = db_or_options as ProxySchemaOptions<Dict>
  }
  let db = options.db
  tableFields = options.tableFields
  let auto_update_timestamp = options.auto_update_timestamp !== false

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
        .prepare(/* sql */ `select "${field}" from "${table}" where id = ?`)
        .pluck()
    }
    let select_all_column_by_id = db.prepare(
      /* sql */ `select * from "${table}" where id = ? limit 1`,
    )
    let select_all = db.prepare(/* sql */ `select * from "${table}"`)

    let count_all = db
      .prepare(/* sql */ `select count(*) from "${table}"`)
      .pluck()

    let select_last_id = db
      .prepare(/* sql */ `select max(id) from "${table}"`)
      .pluck()

    let delete_by_id = db.prepare(
      /* sql */ `delete from "${table}" where id = ?`,
    )
    let delete_by_length = db.prepare(
      /* sql */ `delete from "${table}" where id > ?`,
    )

    let update_dict: Record<string, Statement> = {}
    let update_run_without_updated_at = (
      id: number,
      row: Record<string, any>,
    ) => {
      let params: Record<string, any> = { id }
      let keys: string[] = []
      for (let key in row) {
        if (tableFieldNames.includes(key)) {
          keys.push(key)
          params[key] = toSqliteValue(row[key])
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
          /* sql */ `update "${table}" set ${keys.map(
            key => `"${key}" = :${key}`,
          )} where id = :id`,
        ))
      update.run(params)
    }
    let update_run_with_updated_at = (id: number, row: Record<string, any>) => {
      let params: Record<string, any> = { id }
      let keys: string[] = []
      for (let key in row) {
        if (key === 'updated_at') continue
        if (tableFieldNames.includes(key)) {
          keys.push(key)
          params[key] = toSqliteValue(row[key])
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
          /* sql */ `update "${table}" set ${keys.map(
            key => `"${key}" = :${key}`,
          )}, updated_at = current_timestamp where id = :id`,
        ))
      update.run(params)
    }
    let update_run =
      auto_update_timestamp && tableFieldNames.includes('updated_at')
        ? update_run_with_updated_at
        : update_run_without_updated_at

    let update_one_column_dict: Record<string, Statement> = {}
    for (let field of tableFieldNames) {
      update_one_column_dict[field] = db.prepare(
        auto_update_timestamp &&
          field !== 'updated_at' &&
          tableFieldNames.includes('updated_at')
          ? /* sql */ `update "${table}" set "${field}" = :${field}, updated_at = current_timestamp where id = :id`
          : /* sql */ `update "${table}" set "${field}" = :${field} where id = :id`,
      )
    }

    let insert_empty = db.prepare(
      /* sql */ `insert into "${table}" (id) values (null)`,
    )

    let insert_dict: Record<string, Statement> = {}
    let insert_run = (row: Record<string, any>): number => {
      let params: Record<string, any> = {}
      let keys: string[] = []
      for (let key in row) {
        if (tableFieldNames.includes(key)) {
          keys.push(key)
          params[key] = toSqliteValue(row[key])
        } else if (relationFieldNames.includes(key)) {
          let field = relationFieldDict[key].field
          keys.push(field)
          params[field] = row[key].id
        }
      }
      if (keys.length === 0) {
        return insert_empty.run().lastInsertRowid as number
      }
      let key = keys.join('|')
      let insert =
        insert_dict[key] ||
        (insert_dict[key] = db.prepare(
          /* sql */ `insert into "${table}" (${keys.map(
            key => '"' + key + '"',
          )}) values (${keys.map(key => ':' + key)})`,
        ))
      return insert.run(params).lastInsertRowid as number
    }

    let count_by_id = db
      .prepare(/* sql */ `select count(*) from "${table}" where id = ? limit 1`)
      .pluck()

    let select_id = db.prepare(/* sql */ `select id from "${table}"`).pluck()

    function* iterator() {
      const ids = select_id.all()
      const n = ids.length
      let i: number
      for (i = 0; i < n; i++) {
        yield proxyRow(ids[i])
      }
    }

    function forEach(
      callbackfn: (value: Row<Name>, index: number, array: Row<Name>[]) => void,
    ): void {
      const ids = select_id.all()
      const n = ids.length
      let i: number
      let id: number
      for (i = 0; i < n; i++) {
        id = ids[i]
        callbackfn(proxyRow(id), id, proxy)
      }
    }

    function map<U>(
      callbackfn: (value: Row<Name>, index: number, array: Row<Name>[]) => U,
    ): U[] {
      const results = select_id.all()
      const n = results.length
      let i: number
      let id: number
      for (i = 0; i < n; i++) {
        id = results[i]
        results[i] = callbackfn(proxyRow(id), id, proxy)
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
      const ids = select_id.all()
      const n = ids.length
      const results: Row<Name>[] = []
      let i: number
      let id: number
      for (i = 0; i < n; i++) {
        id = ids[i]
        let row = proxyRow(id)
        if (callbackfn(row, id, proxy)) {
          results.push(row)
        }
      }
      return results
    }

    let slice_1 = db
      .prepare(/* sql */ `select id from "${table}" where id >= :start`)
      .pluck()
    let slice_2 = db
      .prepare(
        /* sql */ `select id from "${table}" where id >= :start and id < :end`,
      )
      .pluck()
    function slice(start?: number, end?: number): Row<Name>[] {
      let args = arguments.length
      const results =
        args == 0
          ? select_all.all()
          : args == 1
          ? slice_1.all({ start })
          : slice_2.all({ start, end })
      const n = results.length
      let i: number
      let id: number
      for (i = 0; i < n; i++) {
        id = results[i]
        results[i] = proxyRow(id)
      }
      return results
    }

    function push(): number {
      let last_id: number = 0
      let i: number
      for (i = 0; i < arguments.length; i++) {
        last_id = insert_run(arguments[i])
      }
      return last_id || select_last_id.get()
    }

    let find_dict: Record<string, Statement> = {}
    function find(filter: Partial<Row<Name>>): Row<Name> | undefined {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('find() expects non-empty filter')
      }
      let key = keys
        .map(key => {
          const value = filter[key] as unknown
          switch (value) {
            case null:
              return `${key}(null)`
            case true:
              filter[key] = 1 as any
              break
            case false:
              filter[key] = 0 as any
              break
            default:
              if (value instanceof Date)
                filter[key] = toSqliteTimestamp(value) as any
              break
          }
          return key
        })
        .join('|')
      let select =
        find_dict[key] ||
        (find_dict[key] = db
          .prepare(
            /* sql */ `select id from "${table}" where ${keys
              .map(key =>
                filter[key] === null
                  ? `"${key}" is null`
                  : `"${key}" = :${key}`,
              )
              .join(' and ')} limit 1`,
          )
          .pluck())
      let id = select.get(filter)
      return id ? proxyRow(id) : undefined
    }

    let filter_dict: Record<string, Statement> = {}
    function filter(filter: Partial<Row<Name>>): Array<Row<Name>> {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('filter() expects non-empty filter')
      }
      let key = keys
        .map(key => {
          const value = filter[key] as unknown
          switch (value) {
            case null:
              return `${key}(null)`
            case true:
              filter[key] = 1 as any
              break
            case false:
              filter[key] = 0 as any
              break
            default:
              if (value instanceof Date)
                filter[key] = toSqliteTimestamp(value) as any
              break
          }
          return key
        })
        .join('|')
      let select =
        filter_dict[key] ||
        (filter_dict[key] = db
          .prepare(
            /* sql */ `select id from "${table}" where ${keys
              .map(key =>
                filter[key] === null
                  ? `"${key}" is null`
                  : `"${key}" = :${key}`,
              )
              .join(' and ')}`,
          )
          .pluck())
      return select.all(filter).map(proxyRow)
    }

    let count_dict: Record<string, Statement> = {}
    function count(filter: Partial<Row<Name>>): number {
      let keys = Object.keys(filter) as Array<string & keyof typeof filter>
      if (keys.length === 0) {
        throw new Error('count() expects non-empty filter')
      }
      let key = keys
        .map(key => {
          const value = filter[key] as unknown
          switch (value) {
            case null:
              return `${key}(null)`
            case true:
              filter[key] = 1 as any
              break
            case false:
              filter[key] = 0 as any
              break
            default:
              if (value instanceof Date)
                filter[key] = toSqliteTimestamp(value) as any
              break
          }
          return key
        })
        .join('|')
      let select =
        count_dict[key] ||
        (count_dict[key] = db
          .prepare(
            /* sql */ `select count(*) from "${table}" where ${keys
              .map(key =>
                filter[key] === null
                  ? `"${key}" is null`
                  : `"${key}" = :${key}`,
              )
              .join(' and ')}`,
          )
          .pluck())
      return select.get(filter)
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
              update_one_column_dict[p].run({ id, [p]: toSqliteValue(value) })
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
          case countSymbol:
          case updateSymbol:
          case Symbol.iterator:
          case 'length':
          case 'push':
          case 'forEach':
          case 'map':
          case 'filter':
          case 'slice':
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
          case countSymbol:
            return count
          case updateSymbol:
            return update_run
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

  let select_create_table: Statement | null = null
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
    if (_tableFields.length == 0) {
      if (!select_create_table) {
        select_create_table = db
          .prepare(/* sql */ `select sql from sqlite_master where name = ?`)
          .pluck()
      }
      let sql = select_create_table.get(table)
      if (!sql) throw new Error(`Table "${table}" doest not exist`)
      _tableFields.push(...parseColumnNames(sql))
    }
    table_dict[table] = proxyTable(table, _tableFields, _relationFields)
  }
  return table_dict
}

export function parseColumnNames(sql: string): string[] {
  let fields = parseCreateTable(sql)
  if (!fields) {
    console.error('failed to parse columns, please specify explicitly')
    return []
  }
  return fields.map(field => field.name)
}

function toSqliteValue(value: unknown) {
  switch (value) {
    case true:
      return 1
    case false:
      return 0
    default:
      if (value instanceof Date) return toSqliteTimestamp(value)
      return value
  }
}
