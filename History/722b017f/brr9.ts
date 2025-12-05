const BASE = 'http://localhost:8000'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  async health(): Promise<string> {
    const res = await fetch(`${BASE}/health`)
    const data = await json<{ status: string }>(res)
    return data.status
  },

  async sum(a: number, b: number): Promise<number> {
    const res = await fetch(`${BASE}/api/sum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a, b })
    })
    const data = await json<{ result: number }>(res)
    return data.result
  },

  async multiply(a: number, b: number): Promise<number> {
    const res = await fetch(`${BASE}/api/multiply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a, b })
    })
    const data = await json<{ result: number }>(res)
    return data.result
  },

  async users(): Promise<Array<{ id: number; name: string; email: string }>> {
    const res = await fetch(`${BASE}/api/users`)
    return json(res)
  },

  async echo(message: string): Promise<string> {
    const res = await fetch(`${BASE}/api/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    const data = await json<{ message: string }>(res)
    return data.message
  }
}
