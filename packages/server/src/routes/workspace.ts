import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { readdir, stat } from "node:fs/promises";
import { join, relative, basename } from "node:path";

type Workspace = {
  title: string;
  repos: string[];
  excludes: RegExp[];
};

const session = {
  workspace: {
    title: "Brain 2",
    repos: ["/Users/bencode/work/brain2/pages", "/Users/bencode/book"],
    excludes: [/\/node_modules\//, /\/\.\w+$/],
  } as Workspace,
};

type TreeNode = {
  type: "dir" | "file";
  name: string;
  path?: string;
  children?: TreeNode[];
};

const TreeNodeSchema = z.object({
  type: z.enum(["dir", "file"]),
  name: z.string(),
  path: z.string().optional(),
  children: z.array(z.any()).optional(),
});

async function buildTree(
  dirPath: string,
  excludes: RegExp[],
): Promise<TreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (excludes.some((pattern) => pattern.test(fullPath))) {
      continue;
    }

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, excludes);
      nodes.push({
        type: "dir",
        name: entry.name,
        path: fullPath,
        children,
      });
    } else if (entry.isFile()) {
      nodes.push({
        type: "file",
        name: entry.name,
        path: fullPath,
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "dir" ? -1 : 1;
  });
}

const getWorkspaceTreeRoute = createRoute({
  method: "get",
  path: "/api/workspace/tree",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(TreeNodeSchema),
          }),
        },
      },
      description: "Get workspace file tree",
    },
  },
});

export function registerWorkspaceRoutes(app: OpenAPIHono) {
  app.openapi(getWorkspaceTreeRoute, async (c) => {
    const { repos, excludes } = session.workspace;
    const trees: TreeNode[] = [];

    for (const repo of repos) {
      const repoName = basename(repo);
      const children = await buildTree(repo, excludes);
      trees.push({
        type: "dir",
        name: repoName,
        path: repo,
        children,
      });
    }

    return c.json({ data: trees });
  });
}
