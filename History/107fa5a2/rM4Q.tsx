import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <header style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/">Home</Link>
          <Link to="/calculator">Calculator</Link>
          <Link to="/users">Users</Link>
          <Link to="/echo">Echo</Link>
          <Link to="/test01">test01</Link>
          <Link to="/test">test</Link>
        </nav>
      </header>
      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  )
}
