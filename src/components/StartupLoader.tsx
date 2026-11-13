import { BookOpen, Sparkles } from 'lucide-react'
import './StartupLoader.css'

export default function StartupLoader() {
  return (
    <main className="startup-loader" role="status" aria-live="polite" aria-label="در حال آماده‌سازی اسمارت‌کلس">
      <div className="startup-loader__ambient" aria-hidden="true">
        <span className="startup-loader__glow startup-loader__glow--one" />
        <span className="startup-loader__glow startup-loader__glow--two" />
        <span className="startup-loader__grid" />
        <span className="startup-loader__star startup-loader__star--one">✦</span>
        <span className="startup-loader__star startup-loader__star--two">✧</span>
        <span className="startup-loader__star startup-loader__star--three">✦</span>
      </div>

      <section className="startup-loader__content">
        <div className="startup-loader__identity">
          <div className="startup-loader__emblem">
            <span className="startup-loader__orbit startup-loader__orbit--outer" />
            <span className="startup-loader__orbit startup-loader__orbit--inner" />
            <span className="startup-loader__emblem-card">
              <BookOpen size={34} strokeWidth={1.65} />
              <i />
            </span>
            <Sparkles className="startup-loader__spark" size={17} strokeWidth={1.7} />
          </div>

          <div className="startup-loader__brand">
            <strong dir="ltr">SmartClass</strong>
            <span>جایی برای بزرگ فکر کردن</span>
          </div>
        </div>

        <div className="startup-loader__divider">
          <span />
          <i>✦</i>
          <span />
        </div>

        <h1>جهان یادگیری تو</h1>
        <p className="startup-loader__message">در حال آماده‌شدن است…</p>
        <p className="startup-loader__description">درس‌ها، مسیرها و ابزارهای هوشمند را برایت آماده می‌کنیم.</p>

        <div className="startup-loader__progress" aria-hidden="true">
          <span />
        </div>
        <span className="startup-loader__status">لطفاً چند لحظه همراه ما باش</span>
      </section>

      <footer className="startup-loader__footer">
        <span dir="ltr">LEARN&nbsp; · &nbsp;CREATE&nbsp; · &nbsp;DISCOVER</span>
        <i />
        <span>یادگیری برای فردا</span>
      </footer>
    </main>
  )
}
