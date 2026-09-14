import { supabase } from './supabase';

const PAGE_SIZE = 1000;

/** Fetches every row of `table` by paging with `.range()`. A single PostgREST
 *  response is capped at the project's max-rows (1000), so an unpaginated
 *  `.select('*')` silently returns only the first page once a table grows past
 *  that — `folders` crossed 1000 and home-preset cards began reporting 40 of a
 *  69-folder widget. Always tie-breaks on `id` (unique): paging over a
 *  non-unique sort key can dupe or skip rows at page boundaries.
 */
export async function fetchAllRows<T>(table: string, sortBy = 'sort_order'): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(sortBy)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}
