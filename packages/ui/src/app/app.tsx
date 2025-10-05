import { Routes, Route } from 'react-router-dom'

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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
      </Route>
    </Routes>
  )
}

export default App
