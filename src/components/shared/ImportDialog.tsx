import { useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { parseCSVBuffer } from '@/utils/csv'
import { parseExcel, isExcelFile } from '@/utils/excel'
import { rowsToTransactions } from '@/utils/importService'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import type { Transaction } from '@/types'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, X } from 'lucide-react'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ipId: number
  onImported: () => void
}

type ImportStep = 'select' | 'preview' | 'result'

interface PreviewRow {
  date: string
  type: string
  amount: string
  category: string
  counterparty: string
  errors: string[]
}

const transactionTypeLabels: Record<Transaction['type'], string> = {
  income: 'Доход',
  expense: 'Расход',
  return_income: 'Возврат дохода',
  return_expense: 'Возврат расхода',
}

export function ImportDialog({ open, onOpenChange, ipId, onImported }: ImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('select')
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [pendingTransactions, setPendingTransactions] = useState<Omit<Transaction, 'id'>[]>([])
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    try {
      let rows: Record<string, string>[]
      if (isExcelFile(file)) {
        rows = await parseExcel(file)
      } else {
        rows = parseCSVBuffer(await file.arrayBuffer())
      }

      if (rows.length === 0) {
        setImportErrors([{ row: 0, message: 'Файл пуст или не содержит данных' }])
        setPreviewRows([])
        setPendingTransactions([])
        setStep('select')
        return
      }

      const { transactions, errors } = rowsToTransactions(rows, ipId)

      // Build preview
      const preview: PreviewRow[] = transactions.slice(0, 10).map(tx => ({
        date: tx.date,
        type: transactionTypeLabels[tx.type],
        amount: Number(tx.amount).toLocaleString('ru-RU', { minimumFractionDigits: 2 }),
        category: tx.category,
        counterparty: tx.counterparty,
        errors: [],
      }))

      setPreviewRows(preview)
      setPendingTransactions(transactions)
      setImportErrors(errors)
      setStep('preview')
    } catch (err) {
      setImportErrors([{ row: 0, message: err instanceof Error ? err.message : 'Ошибка чтения файла' }])
      setStep('select')
    }
  }, [ipId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (pendingTransactions.length === 0) return
    setImporting(true)
    try {
      const imported = await transactionRepo.importBatch(ipId, pendingTransactions)
      setResult({ imported, skipped: pendingTransactions.length - imported, errors: importErrors.length })
      setStep('result')
    } catch {
      setImportErrors(prev => [...prev, { row: 0, message: 'Ошибка сохранения в БД' }])
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    if (result) {
      onImported()
    }
    setStep('select')
    setFileName(null)
    setPreviewRows([])
    setPendingTransactions([])
    setImportErrors([])
    setResult(null)
    onOpenChange(false)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only set false if leaving the drop zone itself
    if (e.currentTarget === e.target) {
      setDragOver(false)
    }
  }

  const typeBadgeVariant = (type: string) => {
    if (type === 'Доход' || type === 'income') return 'default' as const
    if (type === 'Расход' || type === 'expense') return 'secondary' as const
    return 'outline' as const
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт операций</DialogTitle>
          <DialogDescription>
            Загрузите файл CSV (.csv) или Excel (.xlsx, .xls) с операциями
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select file */}
        {step === 'select' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-xs text-muted-foreground">
                .csv, .xlsx, .xls — до 10 000 строк
              </p>
              {fileName && (
                <div className="mt-3 inline-flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  {fileName}
                  <button
                    className="ml-1 p-0.5 rounded hover:bg-background"
                    onClick={(e) => { e.stopPropagation(); setFileName(null) }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            {importErrors.length > 0 && importErrors[0].row === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{importErrors[0].message}</span>
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Найдено операций: <strong>{pendingTransactions.length}</strong>
              </span>
              {importErrors.length > 0 && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Предупреждений: {importErrors.length}
                </span>
              )}
            </div>

            {previewRows.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Дата</TableHead>
                      <TableHead className="text-xs">Тип</TableHead>
                      <TableHead className="text-xs">Сумма</TableHead>
                      <TableHead className="text-xs">Категория</TableHead>
                      <TableHead className="text-xs">Контрагент</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{row.date}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={typeBadgeVariant(row.type)} className="text-[10px]">
                            {row.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{row.amount} ₽</TableCell>
                        <TableCell className="text-xs">{row.category || '—'}</TableCell>
                        <TableCell className="text-xs">{row.counterparty || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pendingTransactions.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center py-2 border-t">
                    ... и ещё {pendingTransactions.length - 10} операций
                  </div>
                )}
              </div>
            )}

            {importErrors.length > 0 && (
              <details className="text-xs text-amber-600">
                <summary className="cursor-pointer hover:text-amber-700">
                  Предупреждения ({importErrors.length})
                </summary>
                <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                  {importErrors.slice(0, 50).map((err, i) => (
                    <div key={i}>Строка {err.row}: {err.message}</div>
                  ))}
                  {importErrors.length > 50 && (
                    <div>И ещё {importErrors.length - 50} предупреждений</div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setStep('select')}>
                Назад
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing || pendingTransactions.length === 0}>
                {importing ? 'Импорт...' : `Импортировать ${pendingTransactions.length} операций`}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <div>
              <p className="text-lg font-semibold">Импорт завершён</p>
              <p className="text-sm text-muted-foreground mt-1">
                Успешно импортировано: <strong>{result?.imported ?? 0}</strong> операций
                {result && result.skipped > 0 && (
                  <span> · дублей пропущено: <strong>{result.skipped}</strong></span>
                )}
                {result && result.errors > 0 && (
                  <span className="text-amber-600"> (с предупреждениями: {result.errors})</span>
                )}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">Готово</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
