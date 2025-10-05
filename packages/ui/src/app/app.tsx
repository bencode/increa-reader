import { Routes, Route } from 'react-router-dom'

import { Button } from '@/components/ui/button'

import { Layout } from './layout'

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Increa Reader</h1>
      <Button>Click me</Button>
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
