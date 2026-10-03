"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger" | "accent";
}) {
  return <span className={`ph-badge ph-badge-${tone}`}>{children}</span>;
}

export function productLabel(product?: {
  name: string;
  strength: string;
}): string {
  if (!product) return "Unknown product";
  return product.name
    .toLocaleLowerCase()
    .includes(product.strength.toLocaleLowerCase())
    ? product.name
    : `${product.name} ${product.strength}`.trim();
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ph-empty">
      <div className="ph-empty-symbol">↗</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ph-panel ${className}`}>
      {(title || actions) && (
        <div className="ph-panel-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="ph-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dialog({
  title,
  eyebrow,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const id = useId(),
    box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (
      box.current?.querySelector<HTMLElement>("[data-autofocus]") ||
      box.current?.querySelector<HTMLElement>("button, input, select, textarea")
    )?.focus();
    return () => {
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  return (
    <div
      className="ph-dialog-backdrop"
      onClick={() => !busy && onClose()}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
        if (event.key === "Tab") {
          const nodes = Array.from(
            box.current?.querySelectorAll<HTMLElement>(
              "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex='0']",
            ) || [],
          ).filter((node) => node.getClientRects().length);
          if (!nodes.length) return;
          if (event.shiftKey && document.activeElement === nodes[0]) {
            event.preventDefault();
            nodes.at(-1)?.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === nodes.at(-1)
          ) {
            event.preventDefault();
            nodes[0]?.focus();
          }
        }
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`ph-dialog ${wide ? "ph-dialog-wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            {eyebrow && <span className="ph-eyebrow">{eyebrow}</span>}
            <h2 id={id}>{title}</h2>
          </div>
          <button
            type="button"
            className="ph-icon-button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export type Column<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  value?: (row: T) => string | number;
  className?: string;
};

export function DataTable<T>({
  id,
  rows,
  columns,
  searchable,
  placeholder = "Search records…",
  empty,
  filter,
  rowKey,
  defaultSort,
  onRow,
}: {
  id: string;
  rows: T[];
  columns: Column<T>[];
  searchable: (row: T) => string;
  placeholder?: string;
  empty?: ReactNode;
  filter?: ReactNode;
  rowKey: (row: T) => string;
  defaultSort?: string;
  onRow?: (row: T) => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState(defaultSort || ""),
    [desc, setDesc] = useState(false),
    [saved, setSaved] = useState<{
      query: string;
      sort: string;
      desc: boolean;
    } | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`recallscope.pharma.view.${id}`);
      if (stored) setSaved(JSON.parse(stored));
    } catch {}
  }, [id]);
  const result = useMemo(() => {
    let filtered = rows.filter((row) =>
      searchable(row).toLowerCase().includes(query.toLowerCase().trim()),
    );
    const column = columns.find((item) => item.key === sort);
    if (column?.value) {
      const getValue = column.value;
      filtered = [...filtered].sort((a, b) => {
        const left = getValue(a),
          right = getValue(b);
        return (
          (typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), undefined, {
                numeric: true,
              })) * (desc ? -1 : 1)
        );
      });
    }
    return filtered;
  }, [rows, query, sort, desc, columns, searchable]);
  const size = 8,
    lastPage = Math.max(0, Math.ceil(result.length / size) - 1),
    currentPage = Math.min(page, lastPage),
    visible = result.slice(currentPage * size, (currentPage + 1) * size);
  return (
    <div className="ph-data-table">
      <div className="ph-table-tools">
        <label className="ph-search">
          <Search size={17} />
          <input
            aria-label={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={placeholder}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        {filter}
        <div className="ph-saved-view">
          {saved && (
            <button
              className="ph-text-button"
              type="button"
              onClick={() => {
                setQuery(saved.query);
                setSort(saved.sort);
                setDesc(saved.desc);
                setPage(0);
              }}
            >
              My view
            </button>
          )}
          <button
            className="ph-icon-button"
            title="Save current search and sort on this device"
            aria-label="Save current search and sort"
            type="button"
            onClick={() => {
              const value = { query, sort, desc };
              setSaved(value);
              try {
                localStorage.setItem(
                  `recallscope.pharma.view.${id}`,
                  JSON.stringify(value),
                );
              } catch {}
            }}
          >
            <Bookmark size={17} />
          </button>
        </div>
      </div>
      <div className="ph-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.className}
                  aria-sort={
                    sort === column.key
                      ? desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  {column.value ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDesc(sort === column.key ? !desc : false);
                        setSort(column.key);
                      }}
                    >
                      {column.label}
                      {sort === column.key &&
                        (desc ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUp size={12} />
                        ))}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} className={onRow ? "ph-clickable-row" : ""}>
                {columns.map((column, index) => (
                  <td key={column.key} className={column.className}>
                    {index === 0 && onRow ? (
                      <button
                        type="button"
                        className="ph-row-button"
                        onClick={() => onRow(row)}
                      >
                        {column.render(row)}
                      </button>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.length &&
        (empty || (
          <Empty
            title="No matching records"
            description="Try a different search or clear the filters."
          />
        ))}
      <footer className="ph-table-footer">
        <span>
          {result.length
            ? `${currentPage * size + 1}–${Math.min((currentPage + 1) * size, result.length)} of ${result.length}`
            : "0 records"}
        </span>
        <div>
          <button
            type="button"
            className="ph-icon-button"
            aria-label="Previous page"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {currentPage + 1} of {lastPage + 1}
          </span>
          <button
            type="button"
            className="ph-icon-button"
            aria-label="Next page"
            disabled={currentPage >= lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}

export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select" | "email";
  required?: boolean;
  value?: string | number;
  hint?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: string | number;
  full?: boolean;
  placeholder?: string;
  defaultsByOption?: Record<string, Record<string, string>>;
};
export function ActionForm({
  fields,
  onSubmit,
  busy,
  error,
  submit = "Save record",
  notice,
  onCancel,
}: {
  fields: Field[];
  onSubmit: (values: Record<string, string>) => void;
  busy: boolean;
  error?: string;
  submit?: string;
  notice?: ReactNode;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(
          Object.fromEntries(
            Array.from(data.entries()).map(([key, value]) => [
              key,
              String(value),
            ]),
          ),
        );
      }}
    >
      <div className="ph-dialog-body">
        {notice && <div className="ph-form-notice">{notice}</div>}
        <div className="ph-form-grid">
          {fields.map((field) => (
            <label
              className={`ph-field ${field.full ? "ph-field-full" : ""}`}
              key={field.name}
            >
              <span>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </span>
              {field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={field.value ?? ""}
                  required={field.required}
                  onChange={(event) => {
                    const defaults =
                      field.defaultsByOption?.[event.target.value];
                    if (!defaults) return;
                    for (const [name, value] of Object.entries(defaults)) {
                      const input =
                        event.currentTarget.form?.elements.namedItem(name);
                      if (
                        input instanceof HTMLInputElement ||
                        input instanceof HTMLSelectElement ||
                        input instanceof HTMLTextAreaElement
                      )
                        input.value = value;
                    }
                  }}
                >
                  {!field.value && <option value="">Select…</option>}
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  rows={3}
                  name={field.name}
                  defaultValue={field.value}
                  required={field.required}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  name={field.name}
                  type={field.type || "text"}
                  defaultValue={field.value}
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  placeholder={field.placeholder}
                />
              )}
              {field.hint && <small>{field.hint}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p className="ph-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="ph-dialog-footer">
        <button
          type="button"
          className="ph-button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="ph-button ph-button-primary"
          type="submit"
          disabled={busy}
        >
          {busy ? "Saving…" : submit}
        </button>
      </footer>
    </form>
  );
}

export function NumberValue({ value, unit }: { value: number; unit?: string }) {
  return (
    <span className="ph-number">
      {new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(value)}
      {unit && <small> {unit}</small>}
    </span>
  );
}
export function shortDate(value: string) {
  return value.length === 7
    ? new Date(`${value}-01T12:00:00Z`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : new Date(
        value.length === 10 ? `${value}T12:00:00Z` : value,
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}
