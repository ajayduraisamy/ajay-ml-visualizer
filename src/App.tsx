import { Route, Routes } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import About from './pages/About';
import CNNVisualizer from './pages/CNNVisualizer';
import Compare from './pages/Compare';
import DecisionBoundaries from './pages/DecisionBoundaries';
import Home from './pages/Home';
import LinearRegression from './pages/LinearRegression';
import NeuralNetworks from './pages/NeuralNetworks';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/linear-regression" element={<LinearRegression />} />
          <Route path="/decision-boundaries" element={<DecisionBoundaries />} />
          <Route path="/neural-networks" element={<NeuralNetworks />} />
          <Route path="/cnn-visualizer" element={<CNNVisualizer />} />
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
