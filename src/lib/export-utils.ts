/**
 * Export data as CSV file download
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return
  
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }))
  
  // CSV header
  const header = cols.map(c => `"${c.label}"`).join(',')
  
  // CSV rows
  const rows = data.map(row => 
    cols.map(c => {
      const value = row[c.key]
      const str = value === null || value === undefined ? '' : String(value)
      return `"${str.replace(/"/g, '""')}"`
    }).join(',')
  )
  
  const csv = [header, ...rows].join('\n')
  
  // Download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}
