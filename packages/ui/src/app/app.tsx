import { Route, Routes } from 'react-router-dom'
import { VisibleContentProvider } from '../contexts/visible-content-context'
import { BoardViewer } from './board-viewer'
import { KnowledgeMap } from './knowledge-map'
import { Layout } from './layout'
import { OnboardingPage } from './onboarding'
import { TabbedViewer } from './tabs/tabbed-viewer'

function App() {
  return (
    <VisibleContentProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<KnowledgeMap />} />
          <Route path="/board" element={<BoardViewer />} />
          <Route path="/views/:repoName/*" element={<TabbedViewer />} />
        </Route>
      </Routes>
    </VisibleContentProvider>
  )
}

export default App
