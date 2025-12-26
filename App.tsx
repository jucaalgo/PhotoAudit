import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import GlobalNav from './components/GlobalNav';
import Dashboard from './pages/Dashboard';
import Configuration from './pages/Configuration';
import Telemetry from './pages/Telemetry';
import Console from './pages/Console';
import Transition from './pages/Transition';
import Export from './pages/Export';

const App = () => {
    return (
        <AppProvider>
            <HashRouter>
                <div className="h-full flex flex-col relative">
                    <GlobalNav />
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/config" element={<Configuration />} />
                        <Route path="/telemetry" element={<Telemetry />} />
                        <Route path="/console" element={<Console />} />
                        <Route path="/transition" element={<Transition />} />
                        <Route path="/export" element={<Export />} />
                    </Routes>
                </div>
            </HashRouter>
        </AppProvider>
    );
};

export default App;