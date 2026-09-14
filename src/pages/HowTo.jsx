import { Link } from 'react-router-dom'
import { Card, SectionHeader, Button } from '../components/ui.jsx'
import { LULAV_DAYS, ordinal } from '../lib/succos.js'

function Step({ n, title, color, children }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl font-display text-lg font-bold text-white" style={{ background: color }}>{n}</span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium text-navy">{title}</h3>
          <div className="mt-1 text-[15px] leading-relaxed text-ink/90">{children}</div>
        </div>
      </div>
    </Card>
  )
}

export default function HowTo() {
  return (
    <div>
      <section className="hero-navy">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="font-cond text-[12.5px] font-semibold uppercase tracking-[0.24em] text-gold">Mivtza Lulav · Soldier's Guide</p>
          <h1 className="mt-2 font-display text-4xl font-normal text-white">How to shake Lulav &amp; Esrog</h1>
          <p className="mt-3 max-w-xl text-lg text-white/85">
            A quick guide so you can do the mitzvah — and help another Yid do it too. 🌿
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {/* Bracha */}
        <Card className="p-6" topColor="var(--color-gold)">
          <SectionHeader>The Bracha</SectionHeader>
          <p className="mt-1 text-sm text-muted">Say this <strong>before</strong> shaking (during the day, and not on Shabbos):</p>
          <div className="mt-4 rounded-xl bg-paper p-5 text-center">
            <p className="font-heb text-2xl leading-relaxed text-navy" dir="rtl">
              בָּרוּךְ אַתָּה ה׳ אֱלֹקֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֺתָיו וְצִוָּנוּ עַל נְטִילַת לוּלָב.
            </p>
            <p className="mt-3 text-sm italic text-muted">
              Boruch Atoh Ado-noy Elo-keinu Melech ho'olom, asher kideshonu bemitzvosov vetzivonu al netilas lulav.
            </p>
            <p className="mt-2 text-sm text-ink/80">
              “Blessed are You… who sanctified us with His mitzvos and commanded us about taking the lulav.”
            </p>
          </div>
          <p className="mt-3 text-sm text-muted">
            The <strong>first time</strong> you shake Lulav this Succos (the first day that isn't Shabbos — this year, the <strong>{ordinal(LULAV_DAYS[0])} day</strong>), also say <strong>Shehecheyanu</strong>.
          </p>
        </Card>

        <Step n="1" title="Get your set ready" color="var(--color-green)">
          Your set is the <strong>lulav</strong> (palm) bound with <strong>3 hadassim</strong> (myrtle) and <strong>2 aravos</strong> (willow), plus the <strong>esrog</strong>. Make sure it's daytime and <strong>not Shabbos</strong>.
        </Step>

        <Step n="2" title="Hold it right" color="var(--color-blue)">
          Take the <strong>lulav in your right hand</strong> (spine facing you). Hold the <strong>esrog in your left hand</strong> — with the <strong>pitom (tip) pointing down</strong> while you say the bracha. Then turn the esrog <strong>right-side up</strong> and bring both hands together.
        </Step>

        <Step n="3" title="Shake in every direction (na'anuim)" color="var(--color-cyan)">
          Gently shake the lulav &amp; esrog <strong>three times in each direction</strong> — to the sides, forward, up, and down — bringing them back to your heart each time. Follow your family's or school's <strong>minhag</strong> for the exact order.
        </Step>

        <Step n="4" title="Help another Yid 🎖️" color="var(--color-red)">
          This is the mivtza! Politely offer to help a fellow Yid do the mitzvah: hand them the set, help them make the bracha and shake, then wish them a <strong>Gut Yom Tov</strong>. Every person you help counts!
        </Step>

        <Step n="5" title="Log your shakes" color="var(--color-gold-dark)">
          Come back to the app and record how many people you helped — add a photo and your story too. Watch your school climb toward its goal!
        </Step>

        <Card className="border-l-4 !border-l-blue bg-blue/5 p-5">
          <p className="text-sm text-navy">
            <strong>Not sure about something?</strong> Always ask your teacher, counselor, or rabbi — they'll be happy to show you.
          </p>
        </Card>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button to="/login" variant="gold">I'm ready — Log my shakes 🌿</Button>
          <Button to="/" variant="outline">See the campaigns</Button>
        </div>
      </div>
    </div>
  )
}
