/**
 * @schema StoreProductCategoryListResponse
 * type: object
 * description: The paginated list of product categories.
 * x-schemaName: StoreProductCategoryListResponse
 * required:
 *   - limit
 *   - offset
 *   - count
 *   - product_categories
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
 *     description: The total number of items.
 *   product_categories:
 *     type: array
 *     description: The list of product categories.
 *     items:
 *       $ref: "#/components/schemas/StoreProductCategory"
 *   estimate_count:
 *     type: number
 *     title: estimate_count
 *     description: The estimated count retrieved from the PostgreSQL query planner, which may be inaccurate.
 *     x-featureFlag: index_engine
 * 
*/

