import { ReactNode } from 'react'

interface LayoutProps {
  toolbar: ReactNode
  sidebar: ReactNode
  sidebarOpen: boolean
  content: ReactNode
}

export function Layout({ toolbar, sidebar, sidebarOpen, content }: LayoutProps): JSX.Element {
  return (
    <div className="app-shell">
      {toolbar}
      <div className="app-body">
        <aside className={'app-sidebar' + (sidebarOpen ? '' : ' is-collapsed')}>{sidebar}</aside>
        <main className="app-content">{content}</main>
      </div>
    </div>
  )
}
