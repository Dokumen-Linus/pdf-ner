import React, { useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Percent,
  Layers,
  Sparkles,
} from "lucide-react"

import "./accuracy-table.css"

export interface AccuracyTableProps {
  pdfs: {
    id: string
    filepath: string
    hasLabels: boolean
  }[]
  entityValues: {
    id: number
    pdfId: string
    entityTypeId: string
    textValue: string
    isLabel: boolean
    nerRunId: string | null
  }[]
  entityTypes: {
    id: string
    name: string
    unique: boolean
    required: boolean
    color: string
    subtype: string
  }[]
}

interface RowType {
  pdfId: string
  pdfName: string
  numTrueLabels: number
  numCorrect: number
  numIncorrect: number
  numFalseNegatives: number
  entityTypes: Record<
    string,
    {
      trueValues: string[]
      predictedValues: string[]
    }
  >
}

export const AccuracyTable: React.FC<AccuracyTableProps> = ({
  pdfs,
  entityValues,
  entityTypes,
}) => {
  // 1. Determine if all entity types are required (to hide false negatives)
  const allEntityTypesRequired = useMemo(() => {
    return entityTypes.length > 0 && entityTypes.every((et) => et.required === true)
  }, [entityTypes])

  // 2. Transform DB data into rows for react-table
  const transformedData = useMemo<RowType[]>(() => {
    return pdfs.map((pdf) => {
      // Get all entity values for this PDF
      const pdfValues = entityValues.filter((val) => val.pdfId === pdf.id)

      // Separate labels and predictions
      const labels = pdfValues.filter((val) => val.isLabel)
      const predictions = pdfValues.filter((val) => !val.isLabel)

      // Find the latest NER run ID from predictions to scope comparison to the latest run
      const sortedPredictions = [...predictions].sort((a, b) => b.id - a.id)
      const latestNerRunId = sortedPredictions[0]?.nerRunId ?? null

      // Filter predictions to only the latest NER run
      const latestPredictions = predictions.filter(
        (val) => val.nerRunId === latestNerRunId,
      )

      // PDF filename extraction
      const pdfName = pdf.filepath.split("/").pop() || pdf.filepath

      // Initialize row structure
      const rowEntityTypes: Record<string, { trueValues: string[]; predictedValues: string[] }> = {}
      entityTypes.forEach((et) => {
        rowEntityTypes[et.id] = {
          trueValues: [],
          predictedValues: [],
        }
      })

      // Populate true values
      labels.forEach((label) => {
        if (rowEntityTypes[label.entityTypeId]) {
          rowEntityTypes[label.entityTypeId].trueValues.push(label.textValue)
        }
      })

      // Populate predicted values for the latest run
      latestPredictions.forEach((pred) => {
        if (rowEntityTypes[pred.entityTypeId]) {
          rowEntityTypes[pred.entityTypeId].predictedValues.push(pred.textValue)
        }
      })

      // Compute statistics per PDF
      let numTrueLabels = labels.length
      let numCorrect = 0
      let numIncorrect = 0
      let numFalseNegatives = 0

      entityTypes.forEach((et) => {
        const { trueValues, predictedValues } = rowEntityTypes[et.id]

        // Compare predicted values against true values
        trueValues.forEach((tVal) => {
          if (predictedValues.includes(tVal)) {
            numCorrect++
          } else {
            numIncorrect++
          }
        })

        // False negatives: predictions not present in true values
        predictedValues.forEach((pVal) => {
          if (!trueValues.includes(pVal)) {
            numFalseNegatives++
          }
        })
      })

      return {
        pdfId: pdf.id,
        pdfName,
        numTrueLabels,
        numCorrect,
        numIncorrect,
        numFalseNegatives,
        entityTypes: rowEntityTypes,
      }
    })
  }, [pdfs, entityValues, entityTypes])

  // 3. Compute sums for the footer
  const totals = useMemo(() => {
    let trueLabelsSum = 0
    let correctSum = 0
    let incorrectSum = 0
    let falseNegativesSum = 0

    transformedData.forEach((row) => {
      trueLabelsSum += row.numTrueLabels
      correctSum += row.numCorrect
      incorrectSum += row.numIncorrect
      falseNegativesSum += row.numFalseNegatives
    })

    const accuracyRate =
      trueLabelsSum > 0 ? Math.round((correctSum / trueLabelsSum) * 100) : 100

    return {
      trueLabelsSum,
      correctSum,
      incorrectSum,
      falseNegativesSum,
      accuracyRate,
    }
  }, [transformedData])

  // 4. Define columns dynamically
  const columns = useMemo<ColumnDef<RowType, any>[]>(() => {
    const cols: ColumnDef<RowType, any>[] = [
      {
        accessorKey: "pdfName",
        header: "PDF Name",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span
              className="font-medium truncate max-w-[200px]"
              title={info.getValue()}
            >
              {info.getValue()}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "numTrueLabels",
        header: "True Labels",
        cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
      },
      {
        accessorKey: "numCorrect",
        header: "Predicted Correct",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 text-green-600 font-semibold dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {info.getValue()}
          </span>
        ),
      },
      {
        accessorKey: "numIncorrect",
        header: "Predicted Incorrect",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 text-red-600 font-semibold dark:text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            {info.getValue()}
          </span>
        ),
      },
    ]

    if (!allEntityTypesRequired) {
      cols.push({
        accessorKey: "numFalseNegatives",
        header: "False Negatives",
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {info.getValue()}
          </span>
        ),
      })
    }

    // Dynamic paired columns for each entity type
    entityTypes.forEach((et) => {
      cols.push({
        id: `group_${et.id}`,
        header: () => (
          <div className="flex items-center gap-2 py-0.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: et.color }}
            />
            <span className="font-bold text-foreground text-xs uppercase tracking-wider">
              {et.name}
            </span>
          </div>
        ),
        columns: [
          {
            id: `${et.id}_true`,
            header: "True Value(s)",
            accessorFn: (row: RowType) => row.entityTypes[et.id]?.trueValues || [],
            cell: (info: any) => {
              const vals = info.getValue() as string[]
              if (vals.length === 0) {
                return <span className="empty-cell-placeholder">—</span>
              }
              return (
                <ul className="value-list">
                  {vals.map((v, idx) => (
                    <li key={idx} className="value-item">
                      <span
                        className="value-badge"
                        style={{
                          backgroundColor: `${et.color}15`,
                          color: et.color,
                          borderColor: `${et.color}35`,
                        }}
                      >
                        {v}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            },
          },
          {
            id: `${et.id}_predicted`,
            header: "Predicted Value(s)",
            accessorFn: (row: RowType) => row.entityTypes[et.id]?.predictedValues || [],
            cell: (info: any) => {
              const preds = info.getValue() as string[]
              const trueVals =
                info.row.original.entityTypes[et.id]?.trueValues || []
              if (preds.length === 0) {
                return <span className="empty-cell-placeholder">—</span>
              }
              return (
                <ul className="value-list">
                  {preds.map((p, idx) => {
                    const isCorrect = trueVals.includes(p)
                    return (
                      <li key={idx} className="value-item">
                        <span
                          className={`value-badge ${
                            isCorrect ? "match-correct" : "match-fn"
                          }`}
                        >
                          {p}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )
            },
          },
        ],
      } as any)
    })

    return cols
  }, [entityTypes, allEntityTypesRequired])

  // 5. Initialize react-table instance
  const table = useReactTable({
    data: transformedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 6. Dashboard Widget Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <div className="flex items-center gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-3 bg-primary/10 rounded-lg text-primary shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Labelled PDFs
            </p>
            <h3 className="text-2xl font-bold tracking-tight">
              {transformedData.length}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Correct Predictions
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {totals.correctSum}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-3 bg-red-500/10 rounded-lg text-red-600 dark:text-red-400 shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Incorrect / Missed
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
              {totals.incorrectSum}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Overall Accuracy Rate
            </p>
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                {totals.accuracyRate}%
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium">
                ({totals.correctSum}/{totals.trueLabelsSum})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Scrollable Sticky Accuracy Table */}
      <div className="accuracy-table-container">
        <table className="accuracy-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="accuracy-table-tr">
                {headerGroup.headers.map((header, idx) => {
                  const isFirstCol = idx === 0
                  const isGroupHeader = header.subHeaders && header.subHeaders.length > 0
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`accuracy-table-th ${
                        isFirstCol ? "sticky-col-left" : ""
                      }`}
                      style={{
                        textAlign: isGroupHeader ? "center" : "left",
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="accuracy-table-tr">
                {row.getVisibleCells().map((cell, idx) => {
                  const isFirstCol = idx === 0
                  return (
                    <td
                      key={cell.id}
                      className={`accuracy-table-td ${
                        isFirstCol ? "sticky-col-left" : ""
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {/* Footer Sum Row */}
          <tfoot>
            <tr className="accuracy-table-footer-tr">
              <td className="accuracy-table-td sticky-col-left font-bold text-foreground">
                {transformedData.length} PDFs
              </td>
              <td className="accuracy-table-td font-semibold text-foreground">
                {totals.trueLabelsSum}
              </td>
              <td className="accuracy-table-td font-semibold text-green-600 dark:text-green-400">
                {totals.correctSum}
              </td>
              <td className="accuracy-table-td font-semibold text-red-600 dark:text-red-400">
                {totals.incorrectSum}
              </td>
              {!allEntityTypesRequired && (
                <td className="accuracy-table-td font-semibold text-amber-600 dark:text-amber-400">
                  {totals.falseNegativesSum}
                </td>
              )}
              {/* Empty cells for all dynamic entity type columns */}
              {entityTypes.map((et) => (
                <React.Fragment key={et.id}>
                  <td className="accuracy-table-td" />
                  <td className="accuracy-table-td" />
                </React.Fragment>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
