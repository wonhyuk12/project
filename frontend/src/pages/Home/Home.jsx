import Hero from './sections/Hero'
import Signature from './sections/Signature'
import Subscription from './sections/Subscription'
import Notice from './sections/Notice'
import Guide from './sections/Guide'
import Footer from '../../components/Footer'

export default function Home() {
  return (
    <>
      <Hero />
      <Signature />
      <Subscription />
      <Notice />
      <Guide />
      <Footer />
    </>
  )
}
