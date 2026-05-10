import { NextResponse } from 'next/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { serializeOperationMetadata } from '@open-mercato/shared/lib/commands/operationMetadata'

export function readStringArrayParam(searchParams: URLSearchParams, key: string): string[] | undefined {
  const values = searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  return values.length ? Array.from(new Set(values)) : undefined
}

export function readNullableParam(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key)
  return value && value.trim().length > 0 ? value.trim() : undefined
}

export function pagedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  extra?: Record<string, unknown>,
) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    ...(extra ?? {}),
  }
}

export function withOperationHeader(
  response: NextResponse,
  logEntry: {
    id?: string | null
    undoToken?: string | null
    commandId?: string | null
    actionLabel?: string | null
    resourceKind?: string | null
    resourceId?: string | null
    createdAt?: Date | string | null
  } | null | undefined,
) {
  if (!logEntry?.undoToken || !logEntry.id || !logEntry.commandId) return response
  response.headers.set(
    'x-om-operation',
    serializeOperationMetadata({
      id: logEntry.id,
      undoToken: logEntry.undoToken,
      commandId: logEntry.commandId,
      actionLabel: logEntry.actionLabel ?? null,
      resourceKind: logEntry.resourceKind ?? 'construction_projects.project',
      resourceId: logEntry.resourceId ?? null,
      executedAt: logEntry.createdAt instanceof Date
        ? logEntry.createdAt.toISOString()
        : typeof logEntry.createdAt === 'string'
          ? logEntry.createdAt
          : new Date().toISOString(),
    }),
  )
  return response
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const escapeValue = (value: string | number | null | undefined) => {
    const normalized = value == null ? '' : String(value)
    if (!/[",\n]/.test(normalized)) return normalized
    return `"${normalized.replace(/"/g, '""')}"`
  }

  return [
    headers.join(','),
    ...rows.map((row) => row.map((value) => escapeValue(value)).join(',')),
  ].join('\n')
}

export function csvResponse(filename: string, body: string): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}

export function handleConstructionProjectsRouteError(error: unknown): NextResponse {
  if (error instanceof CrudHttpError) {
    return NextResponse.json(error.body, { status: error.status })
  }
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  // eslint-disable-next-line no-console
  console.error('Route error details:', { message: errorMessage, stack: errorStack })
  return NextResponse.json(
    { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
    { status: 500 },
  )
}