export function getLeftPanelSearchStatus(searchQuery: string, isFiltering: boolean) {
  if (isFiltering) {
    return 'Filtering...'
  }

  const trimmedQuery = searchQuery.trim()

  if (!trimmedQuery) {
    return ''
  }

  return `Filtering by "${trimmedQuery}"`
}
