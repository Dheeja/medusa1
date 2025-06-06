/**
 * @schema StoreReturnItem
 * type: object
 * description: The return item's details.
 * x-schemaName: StoreReturnItem
 * required:
 *   - id
 *   - quantity
 *   - received_quantity
 *   - damaged_quantity
 *   - item_id
 *   - return_id
 * properties:
 *   id:
 *     type: string
 *     title: id
 *     description: The item's ID.
 *   quantity:
 *     type: number
 *     title: quantity
 *     description: The item's quantity.
 *   received_quantity:
 *     type: number
 *     title: received_quantity
 *     description: The item's received quantity.
 *   damaged_quantity:
 *     type: number
 *     title: damaged_quantity
 *     description: The item's damaged quantity.
 *   reason_id:
 *     type: string
 *     title: reason_id
 *     description: The ID of the item's reason.
 *   note:
 *     type: string
 *     title: note
 *     description: A note with more details on why the item is returned.
 *   item_id:
 *     type: string
 *     title: item_id
 *     description: The ID of the item in the order.
 *   return_id:
 *     type: string
 *     title: return_id
 *     description: The ID of the return this item belongs to.
 *   metadata:
 *     type: object
 *     description: The item's metadata, can hold custom key-value pairs.
 * 
*/

