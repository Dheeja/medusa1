import { existsSync, mkdirSync, readdirSync, statSync } from "fs"
import path from "path"
import { getSidebarItemLink, sidebarAttachCommonOptions } from "./index.js"
import getCoreFlowsRefSidebarChildren from "./utils/get-core-flows-ref-sidebar-children.js"
import { parseTags } from "./utils/parse-tags.js"
import numberSidebarItems from "./utils/number-sidebar-items.js"
import { sortSidebarItems } from "./utils/sidebar-sorting.js"
import { Sidebar } from "types"
import { validateSidebarUniqueIds } from "./utils/validate-sidebar-unique-ids.js"
import getApiRefSidebarChildren from "./utils/get-api-ref-sidebar-children.js"

export type ItemsToAdd = Sidebar.SidebarItem & {
  sidebar_position?: number
}

export type GenerateSidebarOptions = {
  addNumbering?: boolean
  writeToFile?: boolean
}

const customGenerators: Record<
  string,
  (sidebar?: Sidebar.RawSidebar) => Promise<ItemsToAdd[]>
> = {
  "core-flows": getCoreFlowsRefSidebarChildren,
  "api-ref": getApiRefSidebarChildren,
}

function sortItems(itemA: ItemsToAdd, itemB: ItemsToAdd): number {
  const itemASidebarPosition = itemA.sidebar_position || 0
  const itemBSidebarPosition = itemB.sidebar_position || 0

  if (itemASidebarPosition > itemBSidebarPosition) {
    return 1
  }

  return itemASidebarPosition < itemBSidebarPosition ? -1 : 0
}

async function getAutogeneratedSidebarItems(
  dir: string,
  nested = false
): Promise<ItemsToAdd[]> {
  const isRefDir =
    dir.startsWith("/references") && dir !== "/references-overview"
  const basePath = isRefDir ? path.resolve() : path.resolve("app")
  const fullPath = path.resolve(basePath, dir.replace(/^\//, ""))
  const items: ItemsToAdd[] = []

  const files = readdirSync(fullPath)
  let mainPageIndex = -1

  for (const file of files) {
    const filePath = path.join(fullPath, file)
    const fileBasename = path.basename(file)
    if (fileBasename.startsWith("_")) {
      continue
    }

    if (fileBasename !== "page.mdx" && statSync(filePath).isDirectory()) {
      const newItems = await getAutogeneratedSidebarItems(
        filePath.replace(basePath, ""),
        true
      )
      if (nested && newItems.length > 1) {
        items.push({
          type: "sub-category",
          title:
            fileBasename.charAt(0).toUpperCase() + fileBasename.substring(1),
          children: newItems,
          loaded: true,
        })
      } else {
        items.push(...newItems)
      }
      continue
    }

    const newItem = await getSidebarItemLink({
      filePath,
      basePath,
      fileBasename,
    })

    if (!newItem) {
      continue
    }

    items.push(newItem)

    mainPageIndex = items.length - 1
  }

  if (
    mainPageIndex !== -1 &&
    items.length > 1 &&
    items[0].type !== "separator"
  ) {
    // push all other items to be children of that page.
    const mainPageChildren = [
      ...items.splice(0, mainPageIndex),
      ...items.splice(1),
    ]
    mainPageChildren.sort(sortItems)
    items[0].children = mainPageChildren
  } else if (items.length > 1) {
    items.sort(sortItems)
  }

  return items
}

async function getAutogeneratedTagSidebarItems(
  tags: string,
  type: "link" | "ref",
  existingChildren?: Sidebar.RawSidebarItem[]
): Promise<ItemsToAdd[]> {
  const items: ItemsToAdd[] = []

  const parsedTags = parseTags(tags)

  items.push(
    ...parsedTags
      .filter((tagItem) => {
        return existingChildren
          ? existingChildren.every((existingItem) => {
              if (existingItem.type !== "link" && existingItem.type !== "ref") {
                return true
              }

              return !tagItem.path.endsWith(existingItem.path)
            })
          : true
      })
      .map(
        (tagItem) =>
          ({
            type,
            ...tagItem,
          }) as ItemsToAdd
      )
  )

  return items
}

function validateItem(item: Sidebar.RawSidebarItem): void {
  if (!item.type) {
    throw new Error(
      `ERROR: The following item doesn't have a type: ${JSON.stringify(
        item,
        undefined,
        2
      )}`
    )
  }
  if (item.type === "sidebar" && !item.sidebar_id) {
    throw new Error(
      `ERROR: The following sidebar item doesn't have a sidebar_id: ${JSON.stringify(
        item,
        undefined,
        2
      )}`
    )
  }
  if (item.type === "link" && !item.path) {
    throw new Error(
      `ERROR: The following link item doesn't have a path: ${JSON.stringify(
        item,
        undefined,
        2
      )}`
    )
  }
}

async function checkItem(
  item: Sidebar.RawSidebarItem
): Promise<Sidebar.RawSidebarItem> {
  if (item.type === "separator") {
    return item
  }

  validateItem(item)

  if (item.children) {
    item.children = await checkItems(item.children)
  }

  if (item.autogenerate_path) {
    item.children = [
      ...(item.children || []),
      ...(await getAutogeneratedSidebarItems(item.autogenerate_path)).map(
        (child) => {
          delete child.sidebar_position

          return child
        }
      ),
    ]
  } else if (item.autogenerate_tags) {
    item.children = [
      ...(item.children || []),
      ...(await getAutogeneratedTagSidebarItems(
        item.autogenerate_tags,
        item.autogenerate_as_ref ? "ref" : "link",
        item.children
      )),
    ]
  } else if (
    item.custom_autogenerate &&
    Object.hasOwn(customGenerators, item.custom_autogenerate)
  ) {
    item.children = [
      ...(item.children || []),
      ...(await customGenerators[item.custom_autogenerate]()),
    ]
  }

  item.children = sortSidebarItems({
    items: item.children as Sidebar.RawSidebarItem[],
    type: item.sort_sidebar,
  })

  return item
}

async function checkItems(
  items: Sidebar.RawSidebarItem[],
  options?: GenerateSidebarOptions
): Promise<Sidebar.RawSidebarItem[]> {
  let updatedItems = (
    await Promise.all(items.map(async (item) => await checkItem(item)))
  ).filter((item) => {
    if (item.type !== "category" && item.type !== "sub-category") {
      return true
    }

    return (item.children?.length || 0) > 0
  })

  if (options?.addNumbering) {
    updatedItems = numberSidebarItems(updatedItems)
  }

  return sidebarAttachCommonOptions(updatedItems)
}

export async function generateSidebar(
  sidebars: Sidebar.RawSidebar[],
  options?: GenerateSidebarOptions
): Promise<void | Sidebar.RawSidebar[]> {
  const path = await import("path")
  const { writeFileSync } = await import("fs")

  const normalizedSidebars: Sidebar.RawSidebar[] = []

  const { writeToFile = true, ...restOptions } = options || {}

  validateSidebarUniqueIds(sidebars)

  for (const sidebarItem of sidebars) {
    const hasCustomAutogenerator =
      sidebarItem.custom_autogenerate &&
      Object.hasOwn(customGenerators, sidebarItem.custom_autogenerate)
    normalizedSidebars.push({
      ...sidebarItem,
      items: !hasCustomAutogenerator
        ? await checkItems(sidebarItem.items, restOptions)
        : await customGenerators[sidebarItem.custom_autogenerate!](sidebarItem),
    })
  }

  if (!writeToFile) {
    return normalizedSidebars
  }

  const generatedDirPath = path.resolve("generated")

  if (!existsSync(generatedDirPath)) {
    mkdirSync(generatedDirPath)
  }

  // write normalized sidebar
  writeFileSync(
    path.resolve(generatedDirPath, "sidebar.mjs"),
    `export const generatedSidebars = ${JSON.stringify(
      normalizedSidebars,
      null,
      2
    )}`,
    {
      flag: "w",
    }
  )
}
