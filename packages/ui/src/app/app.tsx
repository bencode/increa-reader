import { Routes, Route } from 'react-router-dom'

import { Layout } from './layout'
import { FileViewer } from './file-viewer'
import { VisibleContentProvider } from '../contexts/visible-content-context'

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
          <Route path="/views/:repoName/*" element={<FileViewer />} />
        </Route>
      </Routes>
    </VisibleContentProvider>
  )
}

export default App
