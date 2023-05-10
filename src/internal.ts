import { notNull } from './extension'
import { toSqliteTimestamp } from './helpers'
import crypto from 'crypto'

export let notNullPlaceholder =
  '(not null)|' + crypto.randomBytes(8).toString('base64')

export function filterToKey(filter: Record<string, any>) {
  let res = ''
  for (let [key, value] of Object.entries(filter)) {
    res += '|' + key
    switch (value) {
      case null:
        res += '(null)'
        break
      case notNull:
        res += '(not null)'
        filter[key] = notNullPlaceholder
        break
      case true:
        filter[key] = 1
        break
      case false:
        filter[key] = 0
        break
      default:
        if (value instanceof Date) {
          filter[key] = toSqliteTimestamp(value)
        }
    }
  }
  return res
}
