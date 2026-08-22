import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

// ── SVG icon components ───────────────────────────────────────────────────────

const cls = "h-4 w-4 shrink-0"

function IcoGrid()    { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> }
function IcoServer()  { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/><circle cx="6" cy="5.5" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="12.5" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="19.5" r="1" fill="currentColor" stroke="none"/></svg> }
function IcoBox()     { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg> }
function IcoRocket()  { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg> }
function IcoArchive() { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg> }
function IcoChart()   { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> }
function IcoList()    { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg> }
function IcoBell()    { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> }
function IcoUsers()   { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function IcoGear()    { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function IcoAudit()   { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function IcoBook()    { return <svg className={cls} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> }
function IcoLogout()  { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IcoChevronLeft()  { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> }
function IcoChevronRight() { return <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg> }

// ── Nav definitions ───────────────────────────────────────────────────────────

const mainNav = [
  { to: '/',             label: 'Dashboard',    end: true,  Icon: IcoGrid    },
  { to: '/servers',      label: 'Servers',      end: false, Icon: IcoServer  },
  { to: '/applications', label: 'Applications', end: false, Icon: IcoBox     },
  { to: '/deployments',  label: 'Deployments',  end: false, Icon: IcoRocket  },
  { to: '/backups',      label: 'Backups',      end: false, Icon: IcoArchive },
  { to: '/monitoring',   label: 'Monitoring',   end: false, Icon: IcoChart   },
  { to: '/logs',         label: 'Logs',         end: false, Icon: IcoList    },
  { to: '/alerts',       label: 'Alerts',       end: false, Icon: IcoBell    },
]

const bottomNav = [
  { to: '/docs',       label: 'Docs',       Icon: IcoBook  },
  { to: '/users',      label: 'Users',      Icon: IcoUsers },
  { to: '/settings',   label: 'Settings',   Icon: IcoGear  },
  { to: '/audit-logs', label: 'Audit Logs', Icon: IcoAudit },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCollapsed() {
  try { return localStorage.getItem('sp-sidebar-collapsed') === 'true' } catch { return false }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  onSearch?: () => void
  isOpen?:   boolean
  onClose?:  () => void
}

export default function Sidebar({ onSearch, isOpen = false, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)
  const [collapsed,  setCollapsed]  = useState(readCollapsed)

  useEffect(() => {
    const fetchCount = () =>
      api.get('/api/alerts/counts')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAlertCount(d.open + d.acknowledged) })
        .catch(() => {})
    fetchCount()
    const t = setInterval(fetchCount, 60_000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }
  const handleNavClick = () => { onClose?.() }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sp-sidebar-collapsed', String(next)) } catch {}
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-3 rounded-lg text-sm transition-colors group
     ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
     ${isActive
       ? 'bg-sp-accent/15 text-sp-accent font-medium'
       : 'text-slate-400 hover:text-slate-100 hover:bg-sp-hover'
     }`

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        flex flex-col shrink-0 bg-sp-surface border-r border-sp-border h-screen
        transition-all duration-200 ease-in-out
        ${collapsed ? 'w-14' : 'w-56'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>

        {/* Logo + collapse toggle */}
        <div className={`flex items-center border-b border-sp-border ${collapsed ? 'flex-col gap-2 py-4 px-0' : 'gap-3 px-4 py-4'}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sp-accent shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-none">ServerPilot</p>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Local v0.2</p>
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex items-center justify-center h-6 w-6 rounded text-slate-500 hover:text-slate-200 hover:bg-sp-hover transition-colors shrink-0"
          >
            {collapsed ? <IcoChevronRight /> : <IcoChevronLeft />}
          </button>
          {/* Close button — mobile only */}
          {!collapsed && (
            <button onClick={onClose} className="md:hidden text-slate-500 hover:text-slate-300 transition-colors p-1">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Search button */}
        <div className={`pt-3 pb-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {collapsed ? (
            <button
              onClick={onSearch}
              title="Search (⌘K)"
              className="w-full flex items-center justify-center py-2 rounded-lg bg-sp-hover border border-sp-border text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={onSearch}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sp-hover border border-sp-border text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-colors text-xs"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="text-[10px] font-mono border border-sp-border rounded px-1 py-0.5 text-slate-700">⌘K</kbd>
            </button>
          )}
        </div>

        {/* Main nav */}
        <nav className={`flex-1 overflow-y-auto py-2 space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {mainNav.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={handleNavClick} title={collapsed ? label : undefined}>
              <Icon />
              {!collapsed && <span className="flex-1">{label}</span>}
              {label === 'Alerts' && alertCount > 0 && (
                collapsed ? (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                ) : (
                  <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )
              )}
              {/* Tooltip on collapsed */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-slate-800 border border-sp-border text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom nav */}
        <div className={`py-3 space-y-0.5 border-t border-sp-border ${collapsed ? 'px-1.5' : 'px-2'}`}>
          {bottomNav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={linkClass} onClick={handleNavClick} title={collapsed ? label : undefined}>
              <Icon />
              {!collapsed && label}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded bg-slate-800 border border-sp-border text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* User section */}
        {user && (
          <div className="border-t border-sp-border px-2 py-3">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="h-7 w-7 rounded-full bg-sp-accent/20 border border-sp-accent/30 flex items-center justify-center text-sp-accent font-bold text-xs shrink-0 cursor-default"
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <button onClick={handleLogout} title="Sign out" className="text-slate-500 hover:text-red-400 transition-colors">
                  <IcoLogout />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-sp-hover transition-colors">
                <div className="h-7 w-7 rounded-full bg-sp-accent/20 border border-sp-accent/30 flex items-center justify-center text-sp-accent font-bold text-xs shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-600 truncate leading-tight capitalize">{user.role}</p>
                </div>
                <button onClick={handleLogout} title="Sign out" className="text-slate-500 hover:text-red-400 transition-colors">
                  <IcoLogout />
                </button>
              </div>
            )}
          </div>
        )}

      </aside>
    </>
  )
}
