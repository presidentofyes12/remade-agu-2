import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MinimalDAO from './components/dao/MinimalDAO';
import JoinDAO from './components/dao/JoinDAO';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">DAO Management Platform</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<MinimalDAO />} />
            <Route path="/join/:daoAddress" element={<JoinDAO />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 