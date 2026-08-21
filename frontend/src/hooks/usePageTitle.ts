import { useEffect } from 'react'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ServerPilot` : 'ServerPilot'
    return () => { document.title = 'ServerPilot' }
  }, [title])
}
