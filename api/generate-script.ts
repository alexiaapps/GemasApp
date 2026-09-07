import Anthropic from '@anthropic-ai/sdk'

// Tipos mínimos compatibles con el runtime Node de Vercel, sin depender de @vercel/node.
interface ApiRequest {
  method?: string
  body: unknown
}

interface ApiResponse {
  status: (code: number) => ApiResponse
  json: (body: unknown) => void
}

interface GenerateScriptBody {
  dimensionLabel?: string
  goalText?: string
  // Aceptado por compatibilidad con el frontend; el prompt actual no tiene un lugar definido para insertarlo.
  category?: string | null
}

function buildPrompt(dimensionLabel: string, goalText: string): string {
  return `Eres un escritor especializado en visualizaciones de manifestación muy específicas y sensoriales (NO motivacionales genéricas). Dada esta meta: '${goalText}' (área: ${dimensionLabel}), escribe UNA escena (220-450 palabras — este guion se leerá en voz alta y debe durar entre 1:30 y 3 minutos) narrada en primera persona, tiempo PRESENTE, como si la persona ya estuviera viviendo el resultado de haber logrado esa meta.

Debe incluir:
- Una situación concreta y específica (un momento, un lugar, gente presente)
- Detalle sensorial (qué ve, qué escucha, qué huele, qué siente en el cuerpo)
- Sus PENSAMIENTOS internos en ese momento (breves reflexiones, lo que se dice a sí misma)
- La EMOCIÓN que siente y cómo la experimenta (dónde la siente en el cuerpo, cómo se manifiesta)

Evita frases genéricas de superación personal. Escribe con ritmo pausado y contemplativo, apto para leerse en voz alta como una meditación guiada — usa pausas naturales (oraciones cortas intercaladas con algunas más largas).

Ejemplo de tono (para una meta de carrera musical): 'Estoy sentada en el sillón de mi sala nueva. Mi mejor amiga acaba de llegar con vino para celebrar, y en la pantalla del laptop se ve el contador de reproducciones subiendo mientras suena mi canción de fondo. Siento un nudo cálido en el pecho, esa mezcla de orgullo e incredulidad. Pienso: lo logré, de verdad lo logré...' (y continúa desarrollando la escena con este nivel de profundidad durante todo el guion)

Responde ÚNICAMENTE con este JSON, sin texto adicional ni markdown:
{"title": "Título de 3-6 palabras que resuma la escena", "script": "el texto completo de la escena"}`
}

function extractJson(text: string): { title: string; script: string } | null {
  // Por si el modelo igual envuelve la respuesta en ```json ... ``` a pesar de la instrucción.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.title === 'string' && typeof parsed.script === 'string') {
      return { title: parsed.title, script: parsed.script }
    }
    return null
  } catch {
    return null
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ANTHROPIC_API_KEY vive solo en el entorno del servidor (Vercel), nunca en el bundle del navegador.
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el entorno del servidor' })
    return
  }

  const { dimensionLabel, goalText } = (req.body ?? {}) as GenerateScriptBody

  if (!dimensionLabel || !goalText) {
    res.status(400).json({ error: 'Faltan dimensionLabel y/o goalText' })
    return
  }

  try {
    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048, // hasta ~450 palabras + envoltura JSON, con margen
      thinking: { type: 'disabled' }, // tarea de escritura directa: no hace falta razonar, ahorra tokens
      messages: [{ role: 'user', content: buildPrompt(dimensionLabel, goalText) }],
    })

    const textBlock = message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )

    const parsed = textBlock ? extractJson(textBlock.text) : null

    if (!parsed) {
      console.error('generate-script: respuesta no era el JSON esperado:', textBlock?.text)
      res.status(502).json({ error: 'El modelo no devolvió un formato válido' })
      return
    }

    res.status(200).json(parsed)
  } catch (err) {
    console.error('generate-script error:', err)
    res.status(500).json({ error: 'No se pudo generar el guion' })
  }
}
