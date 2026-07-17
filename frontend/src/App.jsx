import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home/Home'
import Menu from './pages/Menu/Menu'
import NewsList from './pages/News/NewsList'
import NewsDetail from './pages/News/NewsDetail'
import Checkout from './pages/Checkout/Checkout'
import ScrollToHash from './components/ScrollToHash'

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/news" element={<NewsList />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/subscribe" element={<Checkout />} />
      </Routes>
    </BrowserRouter>
  )
}
