export async function fetchPaginated({ path, get, resolvePath, createCycleError }) {
  const firstPage = await get(path);
  if (!firstPage || !Array.isArray(firstPage.results)) return firstPage;

  const results = [...firstPage.results];
  const visitedPages = new Set([path]);
  let nextPage = firstPage.next;

  while (nextPage) {
    const nextPath = resolvePath(nextPage);
    if (visitedPages.has(nextPath)) throw createCycleError();
    visitedPages.add(nextPath);

    const page = await get(nextPath);
    if (!page || !Array.isArray(page.results)) break;
    results.push(...page.results);
    nextPage = page.next;
  }

  return { ...firstPage, next: null, previous: null, results };
}
