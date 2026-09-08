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

  // 23505 = unique_violation. Algunos sources (ej. week_bonus) tienen un índice único en la
  // base de datos además de este chequeo — si alguien más ganó la carrera, no es un error real.
  if (insertError && insertError.code !== '23505') throw insertError
}
