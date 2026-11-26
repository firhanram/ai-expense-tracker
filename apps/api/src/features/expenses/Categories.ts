import { CategoryId } from "@expense/contract"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql"

/**
 * The closed Category set (ADR-0004), seeded by migration: reads only. The
 * agent picks from it and the user may change the pick; nothing adds to it.
 */

export const Category = Schema.Struct({ id: CategoryId, name: Schema.String })
export type Category = typeof Category.Type

const decodeCategories = Schema.decodeUnknownEffect(Schema.Array(Category))

/** Every Category, in seed order. */
export const listCategories = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  return yield* sql`SELECT id, name FROM category ORDER BY sort_order`.pipe(
    Effect.flatMap(decodeCategories),
    Effect.orDie,
  )
})

/** Whether `id` names a Category. The set is fixed, so checking before a write cannot race. */
export const categoryExists = (id: CategoryId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`SELECT id FROM category WHERE id = ${id}`.pipe(Effect.orDie)
    return rows.length > 0
  })

/**
 * The name of the Category an Expense falls to when none fits, or when what
 * it is could not be read (ADR-0004: a classification failure, not a place
 * for miscellaneous spending). The one place it is written.
 */
export const fallbackCategoryName = "Other"

/** The fallback Category's row. Its absence is a broken seed, so a defect. */
export const fallbackCategory = Effect.gen(function* () {
  const all = yield* listCategories
  const found = all.find((category) => category.name === fallbackCategoryName)
  if (found === undefined) {
    return yield* Effect.die(new Error(`The ${fallbackCategoryName} Category is not seeded`))
  }
  return found
})
