import type { ColumnDef } from "@tanstack/react-table";
import type { ResourceResult } from "@/types";
import { boolCell, flagCell, linkCell } from "./pageColumns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack's idiom for columns with mixed value types
export const resourceColumns: ColumnDef<ResourceResult, any>[] = [
  {
    accessorKey: "url",
    header: "URL",
    size: 460,
    meta: { description: "The resource's URL (a link or image). Click to open it in your browser." },
    cell: (c) => linkCell(c.getValue()),
  },
  {
    accessorKey: "resourceType",
    header: "Type",
    size: 100,
    meta: { description: "Whether this resource is a link or an image." },
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 80,
    meta: { description: "The HTTP response status code returned for this resource." },
    cell: (c) => {
      const v = c.getValue();
      return flagCell(v ?? "-", v === null || v >= 400);
    },
  },
  {
    accessorKey: "statusText",
    header: "Status Text",
    size: 190,
    meta: { description: "The HTTP status message returned for this resource." },
  },
  {
    accessorKey: "sourcePage",
    header: "Source Page",
    size: 430,
    meta: { description: "The page this resource was found on. Click to open it in your browser." },
    cell: (c) => linkCell(c.getValue()),
  },
  {
    accessorKey: "isInternal",
    header: "Internal",
    size: 100,
    meta: { description: "Whether the resource is hosted on the same site as the crawled page." },
    cell: (c) => boolCell(c.getValue() as boolean),
  },
  {
    accessorKey: "altText",
    header: "Alt Text",
    size: 240,
    meta: { description: "The alt attribute text for image resources." },
    cell: (c) => c.getValue() ?? "",
  },
  {
    accessorKey: "isInsecure",
    header: "Insecure",
    size: 100,
    meta: { description: "Whether the resource is served over an insecure (HTTP) connection." },
    cell: (c) => boolCell(c.getValue() as boolean, { badWhen: true }),
  },
  {
    accessorKey: "error",
    header: "Error",
    size: 240,
    meta: { description: "The error message if this resource failed to load." },
    cell: (c) => flagCell(c.getValue() ?? "", !!c.getValue()),
  },
];
