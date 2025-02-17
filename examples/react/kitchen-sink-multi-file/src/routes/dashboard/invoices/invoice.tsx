import * as React from 'react'
import { z } from 'zod'
import { fetchInvoiceById, patchInvoice } from '../../../mockTodos'
import { InvoiceFields } from '../../../components/InvoiceFields'
import { invoicesLoader, invoicesRoute } from '.'
import {
  useNavigate,
  Link,
  Route,
  RegisteredRoutesInfo,
} from '@tanstack/router'
import { Loader } from '@tanstack/react-loaders'
import { Action, useAction } from '@tanstack/react-actions'
import { invoicesIndexRoute } from './invoices'

class InvoiceNotFoundError extends Error {}

export const invoiceLoader = new Loader({
  fn: async (invoiceId: number) => {
    console.log('Fetching invoice...')
    const invoice = await fetchInvoiceById(invoiceId)

    if (!invoice) {
      throw new InvoiceNotFoundError(`${invoiceId}`)
    }

    return invoice
  },
  onInvalidate: async () => {
    await invoicesLoader.invalidate()
  },
})

export const updateInvoiceAction = new Action({
  fn: patchInvoice,
  onEachSuccess: async ({ payload }) => {
    await invoiceLoader.invalidateInstance({
      variables: payload.id,
    })
  },
})

export const invoiceRoute = new Route({
  getParentRoute: () => invoicesRoute,
  path: '$invoiceId',
  parseParams: (params) => ({
    invoiceId: z.number().int().parse(Number(params.invoiceId)),
  }),
  stringifyParams: ({ invoiceId }) => ({ invoiceId: `${invoiceId}` }),
  validateSearch: z.object({
    showNotes: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  loader: async ({ context, params: { invoiceId }, preload }) => {
    const { invoiceLoader } = context.loaderClient.loaders

    const invoiceLoaderInstance = invoiceLoader.getInstance({
      variables: invoiceId,
    })

    await invoiceLoaderInstance.load({
      preload,
    })

    return () => invoiceLoaderInstance.useInstance()
  },
  component: function InvoiceView({ useLoader, useSearch }) {
    const {
      state: { data: invoice },
    } = useLoader()()
    const search = useSearch()
    const action = useAction({ action: updateInvoiceAction })
    const navigate = useNavigate()

    const [notes, setNotes] = React.useState(search.notes ?? ``)

    React.useEffect(() => {
      navigate({
        search: (old) => ({ ...old, notes: notes ? notes : undefined }),
        replace: true,
      })
    }, [notes])

    return (
      <form
        key={invoice.id}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const formData = new FormData(event.target as HTMLFormElement)
          action.submit({
            id: invoice.id,
            title: formData.get('title') as string,
            body: formData.get('body') as string,
          })
        }}
        className="p-2 space-y-2"
      >
        <InvoiceFields
          invoice={invoice}
          disabled={action.state.latestSubmission?.status === 'pending'}
        />
        <div>
          <Link
            search={(old) => ({
              ...old,
              showNotes: old?.showNotes ? undefined : true,
            })}
            className="text-blue-700"
          >
            {search.showNotes ? 'Close Notes' : 'Show Notes'}{' '}
          </Link>
          {search.showNotes ? (
            <>
              <div>
                <div className="h-2" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="shadow w-full p-2 rounded"
                  placeholder="Write some notes here..."
                />
                <div className="italic text-xs">
                  Notes are stored in the URL. Try copying the URL into a new
                  tab!
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div>
          <button
            className="bg-blue-500 rounded p-2 uppercase text-white font-black disabled:opacity-50"
            disabled={action.state.latestSubmission?.status === 'pending'}
          >
            Save
          </button>
        </div>
        {action.state.latestSubmission?.payload?.id === invoice.id ? (
          <div key={action.state.latestSubmission?.submittedAt}>
            {action.state.latestSubmission?.status === 'success' ? (
              <div className="inline-block px-2 py-1 rounded bg-green-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
                Saved!
              </div>
            ) : action.state.latestSubmission?.status === 'error' ? (
              <div className="inline-block px-2 py-1 rounded bg-red-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
                Failed to save.
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    )
  },
})
