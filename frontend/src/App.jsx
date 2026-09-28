import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Tours from './pages/Tours';
import HowItWorks from './pages/HowItWorks';
import Faq from './pages/Faq';
import TourDetail from './pages/TourDetail';
import Checkout from './pages/Checkout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tours" element={<Tours />} />
        <Route path="/how" element={<HowItWorks />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/tour/:id" element={<TourDetail />} />
        <Route path="/checkout" element={<Checkout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
