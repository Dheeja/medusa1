/**
 * @schema AdminPricePreferenceListResponse
 * type: object
 * description: The paginated list of price preferences.
 * x-schemaName: AdminPricePreferenceListResponse
 * required:
 *   - limit
 *   - offset
 *   - count
 *   - price_preferences
 * properties:
 *   limit:
 *     type: number
 *     title: limit
 *     description: The maximum number of items returned.
 *   offset:
 *     type: number
 *     title: offset
 *     description: The number of items skipped before retrieving the returned items.
 *   count:
 *     type: number
 *     title: count
 *     description: The total count of items.
 *   price_preferences:
 *     type: array
 *     description: The list of price preferences.
 *     items:
 *       $ref: "#/components/schemas/AdminPricePreference"
 *   estimate_count:
 *     type: number
 *     title: estimate_count
 *     description: The estimated count retrieved from the PostgreSQL query planner, which may be inaccurate.
 *     x-featureFlag: index_engine
 * 
*/

