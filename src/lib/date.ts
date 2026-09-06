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

export function currentWeekStartISO(): string {
  return toISODate(mondayOfWeek(new Date()))
}
