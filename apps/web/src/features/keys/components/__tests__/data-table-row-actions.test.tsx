/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { after, afterEach, describe, test } from 'node:test'

import { Window } from 'happy-dom'

import type { ApiKey } from '../../types'

const domWindow = new Window({ url: 'https://console.example.test/keys' })
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'Node',
  'Element',
  'Event',
  'KeyboardEvent',
  'PointerEvent',
  'MouseEvent',
  'FocusEvent',
  'CustomEvent',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { getCoreRowModel, useReactTable } = await import('@tanstack/react-table')
const { api } = await import('@/lib/api')
const { DataTableRow } =
  await import('@/components/data-table/core/data-table-row')
const { Table, TableBody } = await import('@/components/ui/table')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ApiKeysProvider, useApiKeys } = await import('../api-keys-provider')
const { useApiKeysColumns } = await import('../api-keys-columns')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = {
  get: ApiMethod
  post: ApiMethod
}

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
let activeRoot: ReturnType<typeof createRoot> | null = null

const apiKey: ApiKey = {
  id: 42,
  name: 'First-open key',
  key: 'sk-masked',
  status: 1,
  remain_quota: 100,
  used_quota: 0,
  unlimited_quota: false,
  expired_time: -1,
  created_time: 1,
  accessed_time: 0,
  group: 'default',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}
const apiKeys = [apiKey]

function KeyActionsTable() {
  useApiKeys()
  const columns = useApiKeysColumns(1)
  const table = useReactTable({
    data: apiKeys,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const row = table.getRowModel().rows[0]
  assert.ok(row)

  return (
    <Table>
      <TableBody>
        <DataTableRow row={row} cellRenderColumns={table.options.columns} />
      </TableBody>
    </Table>
  )
}

async function clickLikeBrowser(element: HTMLButtonElement) {
  const pointerInit = {
    bubbles: true,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  }

  await act(async () =>
    element.dispatchEvent(new PointerEvent('pointerdown', pointerInit))
  )
  await act(async () =>
    element.dispatchEvent(new MouseEvent('mousedown', pointerInit))
  )
  await act(async () => element.focus())
  await act(async () =>
    element.dispatchEvent(new PointerEvent('pointerup', pointerInit))
  )
  await act(async () =>
    element.dispatchEvent(new MouseEvent('mouseup', pointerInit))
  )
  await act(async () =>
    element.dispatchEvent(new MouseEvent('click', pointerInit))
  )
}

afterEach(async () => {
  if (activeRoot) {
    await act(async () => activeRoot?.unmount())
    activeRoot = null
  }
  apiClient.get = originalGet
  apiClient.post = originalPost
  document.body.replaceChildren()
  window.localStorage.clear()
})

after(() => domWindow.close())

describe('API key row actions', () => {
  test('keeps the menu open while the private key prefetch is pending', async () => {
    let keyRequestStarted = false
    const pendingKeyRequest = new Promise<{ data: unknown }>(() => undefined)

    apiClient.get = async (url) => {
      if (url === '/api/status') return { data: {} }
      if (url === '/api/user/self/groups') {
        return {
          data: {
            success: true,
            data: { default: { desc: 'Default', ratio: 1 } },
          },
        }
      }
      throw new Error(`Unexpected GET ${url}`)
    }
    apiClient.post = async (url) => {
      assert.equal(url, '/api/token/42/key')
      keyRequestStarted = true
      return pendingKeyRequest
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const host = document.createElement('div')
    document.body.append(host)
    activeRoot = createRoot(host)

    await act(async () => {
      activeRoot?.render(
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <TooltipProvider>
              <ApiKeysProvider>
                <KeyActionsTable />
              </ApiKeysProvider>
            </TooltipProvider>
          </I18nextProvider>
        </QueryClientProvider>
      )
    })
    await act(async () => {
      while (queryClient.isFetching() > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    })

    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-column-id="actions"] [data-slot="dropdown-menu-trigger"]'
    )
    assert.ok(trigger)

    await clickLikeBrowser(trigger)

    assert.equal(keyRequestStarted, true)
    assert.equal(
      trigger.getAttribute('aria-expanded'),
      'true',
      'the first click should keep the action menu open while the key loads'
    )
    assert.ok(document.querySelector('[data-slot="dropdown-menu-content"]'))
  })
})
