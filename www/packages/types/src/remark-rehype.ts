import { Node } from "unist-builder"
import { SlugChange } from "./build-scripts.js"

export interface UnistNode extends Node {
  type: string
  name?: string
  tagName?: string
  value?: string
  properties?: {
    [key: string]: string
  }
  attributes?: {
    name: string
    value: unknown
    type?: string
  }[]
  children?: UnistNode[]
  ordered?: boolean
  url?: string
  spread?: boolean
  depth?: number
  lang?: string
}

export type ArrayExpression = {
  type: "ArrayExpression"
  elements: Expression[]
}

export type ObjectExpression = {
  type: "ObjectExpression"
  properties: AttributeProperty[]
}

export type LiteralExpression = {
  type: "Literal"
  value: unknown
  raw: string
}

export type JSXElementExpression = {
  type: "JSXElement" | "JSXFragment"
  children: Expression[]
}

export type JSXTextExpression = {
  type: "JSXText"
  value: string
  raw: string
}

export type Expression =
  | {
      type: string
    }
  | ArrayExpression
  | ObjectExpression
  | LiteralExpression
  | JSXElementExpression
  | JSXTextExpression

export interface Estree {
  body?: {
    type?: string
    expression?: Expression
  }[]
}

export interface UnistNodeWithData extends UnistNode {
  attributes: {
    name: string
    value:
      | {
          data?: {
            estree?: Estree
          }
          value?: string
        }
      | string
    type?: string
  }[]
}

export interface AttributeProperty {
  key: {
    name?: string
    value?: string
    raw: string
  }
  value:
    | {
        type: "Literal"
        value: unknown
        raw: string
      }
    | {
        type: "JSXElement"
        // TODO add correct type if necessary
        openingElement: unknown
      }
    | ArrayExpression
}

export interface UnistTree extends Node {
  children: UnistNode[]
}

export declare type CloudinaryConfig = {
  cloudName?: string
  flags?: string[]
  resize?: {
    action: string
    width?: number
    height?: number
    aspectRatio?: string
  }
  roundCorners?: number
}

export declare type CrossProjectLinksOptions = {
  baseUrl: string
  projectUrls?: {
    [k: string]: {
      url: string
      path?: string
    }
  }
  useBaseUrl?: boolean
}

export declare type BrokenLinkCheckerOptions = {
  rootBasePath?: {
    default: string
    overrides?: {
      [k: string]: string
    }
  }
  hasGeneratedSlugs?: boolean
  generatedSlugs?: SlugChange[]
  crossProjects: {
    [k: string]: {
      projectPath: string
      contentPath?: string
      hasGeneratedSlugs?: boolean
      generatedSlugs?: SlugChange[]
      skipSlugValidation?: boolean
    }
  }
}

export declare type ComponentLinkFixerLinkType = "md" | "value"

export declare type ComponentLinkFixerOptions = {
  filePath?: string
  basePath?: string
  checkLinksType: ComponentLinkFixerLinkType
}

export declare type LocalLinkOptions = {
  filePath?: string
  basePath?: string
}

export type ExpressionJsVarItem = {
  original: AttributeProperty
  data?: unknown
}

export type ExpressionJsVarLiteral = {
  original: {
    type: "Literal"
    value: unknown
    raw: string
  }
  data?: unknown
}

export type ExpressionJsVarObj = {
  [k: string]: ExpressionJsVarItem | ExpressionJsVar | ExpressionJsVar[]
}

export type ExpressionJsVar = ExpressionJsVarObj | ExpressionJsVarLiteral
