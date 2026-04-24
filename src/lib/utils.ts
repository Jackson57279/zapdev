import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { type TreeItem } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function convertFilesToTreeItems(
  files: Record<string, string>
): TreeItem[] {
  interface TreeNode {
    [key: string]: TreeNode | null;
  }

  const tree: TreeNode = {};
  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split("/");
    let current = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = null;
  }

  function convertNode(node: TreeNode, name?: string): TreeItem[] | TreeItem {
    const entries = Object.entries(node);

    if (entries.length === 0) {
      return name || "";
    }

    const children: TreeItem[] = [];

    for (const [key, value] of entries) {
      if (value === null) {
        children.push(key);
      } else {
        const subTree = convertNode(value, key);
        if (Array.isArray(subTree)) {
          children.push([key, ...subTree]);
        } else {
          children.push([key, subTree]);
        }
      }
    }

    return children;
  }

  const result = convertNode(tree);
  return Array.isArray(result) ? result : [result];
};

export function sanitizeTextForDatabase(text: string): string {
  if (typeof text !== "string") {
    return "";
  }

  return text.replace(/\u0000/g, "");
}

export function sanitizeJsonForDatabase<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeTextForDatabase(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonForDatabase(item)) as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeJsonForDatabase(value);
    }
    return sanitized as T;
  }

  return obj;
}

export function sanitizeAnyForDatabase<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeTextForDatabase(value) as T;
  }

  if (typeof value === "object") {
    return sanitizeJsonForDatabase(value);
  }

  return value;
}
