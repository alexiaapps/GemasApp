import { supabase } from './supabase'

/** Inserta una transacción de gemas solo si no existe ya una para ese user/source/source_id. */
export async function awardGemOnce(
  userId: string,
  amount: number,
  dimensionKey: string,
  source: string,
  sourceId: string,
) {
  const { data: existing, error: selectError } = await supabase
    .from('gem_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', source)
    .eq('source_id', sourceId)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return

  const { error: insertError } = await supabase.from('gem_transactions').insert({
    user_id: userId,
    amount,
    dimension_key: dimensionKey,
    source,
    source_id: sourceId,
  })

  if (insertError) throw insertError
}
