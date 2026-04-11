import { Route, Routes } from 'react-router-dom'
import { VisibleContentProvider } from '../contexts/visible-content-context'
import { BoardViewer } from './board-viewer'
import { Layout } from './layout'
import { TabbedViewer } from './tabs/tabbed-viewer'

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">AI Chat</h1>
    </div>
  )
}

function App() {
  return (
    <VisibleContentProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/board" element={<BoardViewer />} />
          <Route path="/views/:repoName/*" element={<TabbedViewer />} />
        </Route>
      </Routes>
    </VisibleContentProvider>
  )
}

export default App
