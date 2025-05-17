import { useEndpoint } from "../api";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import { useState } from "react";

interface ItemsSoldData {
  ProdType: string;
  ItemsSold: number;
}

const columnHelper = createColumnHelper<ItemsSoldData>();

const columns = [
  columnHelper.accessor("ProdType", {
    header: "Product Type",
    cell: (info: { getValue: () => string }) => info.getValue(),
  }),
  columnHelper.accessor("ItemsSold", {
    header: "Items Sold",
    cell: (info: { getValue: () => number }) => info.getValue().toLocaleString(),
  }),
];

interface ItemsSoldProps {
  compact?: boolean;
  defaultPageSize?: number;
}

export default function ItemsSold({ compact = false, defaultPageSize = 10 }: ItemsSoldProps) {
  const { data, isLoading, error } = useEndpoint<ItemsSoldData[]>("items", "/items-sold");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-pulse text-sky-900 text-lg font-medium">Loading...</div>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-red-600">Error loading data</p>
        </div>
      </div>
    </div>
  );

  // Classes to be applied to the component container based on compact mode
  const containerClasses = compact 
    ? "bg-white rounded-xl shadow-lg border border-slate-100 h-full flex flex-col"
    : "bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100";

  return (
    <div className={containerClasses}>
      {!compact && (
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white">
          <h2 className="text-2xl font-semibold text-slate-800 mb-1">
            Items Sold per Product Type
          </h2>
          <p className="text-slate-500 text-sm">Breakdown of items sold by product category</p>
        </div>
      )}
      
      {compact && (
        <div className="px-2 py-1 border-b border-slate-100">
          <h3 className="text-sm font-medium text-slate-800">Items Sold per Product Type</h3>
        </div>
      )}
      
      {/* Global Filter - Only show if not compact */}
      {!compact && (
        <div className="p-4 border-b border-slate-100">
          <input
            value={globalFilter ?? ""}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Search all columns..."
          />
        </div>
      )}

      <div className={compact ? "flex-1 flex flex-col p-2" : "p-6"}>
        <div className={compact ? "flex-1 overflow-auto" : "overflow-x-auto"}>
          <table className="min-w-full divide-y divide-slate-200">
            <thead className={compact ? "sticky top-0 bg-white z-10" : ""}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
                        !compact ? 'cursor-pointer hover:bg-slate-50' : ''
                      }`}
                      onClick={!compact ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {(!compact && {
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as 'asc' | 'desc']) ?? null}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors duration-150">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={`mt-4 flex items-center justify-between ${compact ? "border-t border-slate-200 pt-2" : ""}`}>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              {'<<'}
            </button>
            <button
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {'<'}
            </button>
            <button
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {'>'}
            </button>
            <button
              className="px-3 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              {'>>'}
            </button>
          </div>
          <span className="text-sm text-slate-600">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => {
              table.setPageSize(Number(e.target.value))
            }}
            className="px-3 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            {[5, 10, 20, 30, 40, 50].map(pageSize => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
} 