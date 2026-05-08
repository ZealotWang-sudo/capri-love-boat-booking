"use client";

import { useMemo, useState } from "react";

export default function FaqAccordion({ items, labels }) {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState(() =>
    items.length > 0 ? new Set([items[0].id]) : new Set(),
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const searchableText = `${item.question} ${item.answer}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [items, query]);

  function toggleItem(itemId) {
    setOpenItems((currentOpenItems) => {
      const nextOpenItems = new Set(currentOpenItems);

      if (nextOpenItems.has(itemId)) {
        nextOpenItems.delete(itemId);
      } else {
        nextOpenItems.add(itemId);
      }

      return nextOpenItems;
    });
  }

  return (
    <div>
      <label className="block text-xs uppercase tracking-[0.22em] text-stone-500">
        {labels.searchLabel}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="mt-4 block w-full border border-stone-300 bg-[#fbf8f3] px-5 py-4 text-base normal-case tracking-normal text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-950"
        />
      </label>

      <div className="mt-10 divide-y divide-stone-300 border-y border-stone-300">
        {filteredItems.map((item) => {
          const isOpen = openItems.has(item.id);

          return (
            <article key={item.id}>
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-6 py-7 text-left"
              >
                <span className="max-w-3xl text-xl font-normal leading-8 text-stone-950">
                  {item.question}
                </span>
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center border border-stone-950 text-lg leading-none">
                  {isOpen ? "-" : "+"}
                </span>
              </button>
              {isOpen ? (
                <div className="max-w-3xl pb-8 text-base leading-8 text-stone-600">
                  {item.answer}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <p className="mt-8 border border-stone-300 bg-[#fbf8f3] p-6 text-sm leading-7 text-stone-600">
          {labels.noResults}
        </p>
      ) : null}
    </div>
  );
}
