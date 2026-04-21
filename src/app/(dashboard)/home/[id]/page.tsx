import { notFound } from 'next/navigation'
import { fetchClientById } from '@/lib/actions/clients'
import ClientDetail from '@/components/client/ClientDetail'

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const client = await fetchClientById(id)

  if (!client) notFound()

  return <ClientDetail client={client} initialTab={tab} />
}
