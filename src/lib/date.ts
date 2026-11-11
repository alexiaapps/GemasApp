export function toISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Lunes de la semana que contiene `date`, en horario local. */
export function mondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = domingo ... 6 = sábado
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Día 1 del mes de `date` a las 00:00, en horario local. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

export function currentWeekStartISO(): string {
  return toISODate(mondayOfWeek(new Date()))
}

/** Domingo (último día) de la semana que empieza en `weekStartISO`, como ISO date. */
export function weekEndISO(weekStartISO: string): string {
  const d = new Date(`${weekStartISO}T00:00:00`)
  d.setDate(d.getDate() + 6)
  return toISODate(d)
}
