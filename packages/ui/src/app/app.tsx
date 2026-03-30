import { Route, Routes } from 'react-router-dom'
import { VisibleContentProvider } from '../contexts/visible-content-context'
import { BoardViewer } from './board-viewer'
import { FileViewer } from './file-viewer'
import { Layout } from './layout'

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
          <Route path="/views/:repoName/*" element={<FileViewer />} />
        </Route>
      </Routes>
    </VisibleContentProvider>
  )
}

export default App
