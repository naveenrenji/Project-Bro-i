import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CommandCenter } from '@/views/CommandCenter'
import { DeepDive } from '@/views/DeepDive'
import { NTRProjector } from '@/views/NTRProjector'
import { ProgramFinancial } from '@/views/ProgramFinancial'
import { AskNavs } from '@/views/AskNavs'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/explore" element={<DeepDive />} />
          <Route path="/projector" element={<NTRProjector />} />
          <Route path="/program-financial" element={<ProgramFinancial />} />
          <Route path="/ask-navs" element={<AskNavs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
